import { expect, test, type Page } from "@playwright/test";
import { e2eDb, loginAs, logout } from "./helpers";

const sql = async (query: string, args: (string | number)[] = []) => {
  const db = e2eDb();
  const res = await db.execute({ sql: query, args });
  db.close();
  return res.rows;
};
const level = async (login: string, building: string) =>
  (
    await sql(
      `SELECT bp.level, bp.score FROM BuildingProgress bp JOIN City c ON c.id = bp.cityId JOIN User u ON u.id = c.studentId
       JOIN BuildingType bt ON bt.id = bp.buildingTypeId WHERE u.login = ? AND bt.key = ?`,
      [login, building],
    )
  )[0] as unknown as { level: number; score: number | null };

async function openTask(page: Page, building: string, title: string) {
  await page.goto(`/kk/student/building/${building}`);
  await page
    .locator("li", { hasText: title })
    .getByRole("link", { name: /Бастау|Қайта орындау|Жалғастыру/ })
    .click();
  const start = page.getByRole("button", { name: /Бастау|Қайта орындау/ });
  await expect(start.or(page.getByRole("button", { name: /Келесі|Тапсыру/ })).first()).toBeVisible();
  if (await start.isVisible()) await start.click();
  await expect(page.getByRole("button", { name: /Келесі|Тапсыру/ })).toBeVisible();
}

async function answerChoices(page: Page, answers: string[]) {
  for (const [i, a] of answers.entries()) {
    if (a) await page.getByText(a, { exact: true }).click();
    if (i < answers.length - 1) await page.getByRole("button", { name: "Келесі" }).click();
  }
  await page.getByRole("button", { name: "Тапсыру" }).click();
  const confirm = page.getByRole("button", { name: "Иә, тапсыру" });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect(page).toHaveURL(/\/result\//);
}

test.describe("building progression (Stage 6)", () => {
  test("a first result builds the empty lot and the city shows it (acceptance #3)", async ({ page }) => {
    // Тимур's grammar palace is an empty lot; 2 of 3 "Н или НН" answers right → partial score.
    expect((await level("timur", "grammar")).level).toBe(0);
    await loginAs(page, "timur");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await openTask(page, "grammar", "Н или НН?");
    await page.getByText("деревя..ый", { exact: true }).click();
    await page.getByText("стекля..ый", { exact: true }).click();
    await page.getByRole("button", { name: "Келесі" }).click();
    await page.getByText("осе..ий", { exact: true }).click();
    await page.getByText("лимо..ый", { exact: true }).click();
    await page.getByRole("button", { name: "Келесі" }).click();
    await page.getByRole("button", { name: "Тапсыру" }).click();
    await page.getByRole("button", { name: "Иә, тапсыру" }).click();

    await expect(page.getByRole("img", { name: "6.7/10" })).toBeVisible();
    await expect(page.getByText("+3 деңгей!")).toBeVisible();
    await expect(page.getByText("Грамматика сарайы 3-деңгейге көтерілді")).toBeVisible();
    expect(await level("timur", "grammar")).toMatchObject({ level: 3, score: 6.7 });

    // Back in the city the palace plays its build animation once.
    await page.goto("/kk/student");
    await expect(page.locator('.plot[data-key="grammar"] .is-rising')).toHaveCount(1);
  });

  test("a better score upgrades the building and the parent is notified (acceptance #4, §8)", async ({ page }) => {
    // Дамир: tower = idioms 6 (L3). Synonyms 10/10 → BEST average (6 + 10) / 2 = 8 → L4.
    expect((await level("damir", "tower")).level).toBe(3);
    await loginAs(page, "damir");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await openTask(page, "tower", "Синонимы, антонимы, значение слова");
    await answerChoices(page, ["храбрый", "скупой", "однообразная привычная работа"]);
    await expect(page.getByText("Сөздер мұнарасы 4-деңгейге көтерілді")).toBeVisible();
    expect(await level("damir", "tower")).toMatchObject({ level: 4, score: 8 });

    const notes = await sql(
      `SELECT n.type FROM Notification n JOIN User p ON p.id = n.recipientId WHERE p.login = 'parent2' AND n.readAt IS NULL AND n.type = 'TOPIC_RESULT' AND n.payload LIKE '%Фразеологизмы%'`,
    );
    expect(notes.length).toBeGreaterThan(0);
  });

  test("a worse score never lowers the building (spec §4)", async ({ page }) => {
    // Дамир: library uses AVERAGE mode, lighthouse 9 → L4. Retake with no answers: average 4.5, level stays 4.
    expect((await level("damir", "library")).level).toBe(4);
    await loginAs(page, "damir");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await openTask(page, "library", "Смотритель маяка");
    await answerChoices(page, ["", "", ""]);
    await expect(page.getByRole("img", { name: "0/10" })).toBeVisible();
    await expect(page.getByText("Ғимарат 4-деңгейде сақталды")).toBeVisible();
    expect(await level("damir", "library")).toMatchObject({ level: 4, score: 4.5 });
  });

  test("the teacher grades an essay and the student's city updates (acceptance #8)", async ({ page }) => {
    expect((await level("madina", "academy")).level).toBe(0);
    await loginAs(page, "teacher");
    await expect(page).toHaveURL(/\/kk\/teacher$/);
    await page.goto("/kk/teacher/review");
    const row = page.locator("li", { hasText: "Мадина Оспанова" });
    await row.getByRole("link", { name: "Бағалау" }).click();

    await expect(page.getByText("Пётр Гринёв").first()).toBeVisible(); // the essay text
    await page.locator('label:has(input[name="c_content"][value="4"])').click();
    await page.locator('label:has(input[name="c_literacy"][value="2"])').click();
    await page.locator('label:has(input[name="c_structure"][value="3"])').click();
    await expect(page.getByText("9/10")).toBeVisible();
    await page.getByRole("textbox", { name: "Оқушыға пікір" }).fill("Отличное эссе, следи за запятыми.");
    await page.getByRole("button", { name: "Бағалау" }).click();
    await expect(page).toHaveURL(/\/kk\/teacher\/review$/);
    await expect(page.locator("li", { hasText: "Мадина Оспанова" }).getByRole("link")).toHaveCount(0);

    expect(await level("madina", "academy")).toMatchObject({ level: 4, score: 9 });

    // The student sees the score and the feedback.
    await logout(page);
    await loginAs(page, "madina");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await page.goto("/kk/student/building/academy");
    await expect(page.locator("li", { hasText: "Мой любимый" }).getByText("Орындалды · 9/10")).toBeVisible();
    await page.locator("li", { hasText: "Мой любимый" }).getByRole("link", { name: "Нәтиже" }).click();
    await expect(page.getByText("Отличное эссе, следи за запятыми.")).toBeVisible();
  });

  test("returning work for redo frees the task for a new attempt", async ({ page }) => {
    await loginAs(page, "teacher");
    await expect(page).toHaveURL(/\/kk\/teacher$/);
    await page.goto("/kk/teacher/review");
    await page.locator("li", { hasText: "Аружан" }).getByRole("link", { name: "Бағалау" }).click();
    await page.getByRole("textbox", { name: "Оқушыға пікір" }).fill("Добавь пример из текста.");
    await page.getByRole("button", { name: "Қайта орындауға қайтару" }).click();
    await expect(page).toHaveURL(/\/kk\/teacher\/review$/);

    await logout(page);
    await loginAs(page, "aruzhan");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await page.goto("/kk/student/building/academy");
    const item = page.locator("li", { hasText: "Мой любимый" });
    await expect(item.getByText("Қайта орындау керек")).toBeVisible();
    await item.getByRole("link", { name: "Қайта орындау" }).click();
    await expect(page.getByRole("button", { name: /Бастау|Қайта орындау/ })).toBeVisible(); // not blocked
  });

  test("a parent cannot open the review queue", async ({ page }) => {
    await loginAs(page, "parent");
    await expect(page).toHaveURL(/\/kk\/parent(\/child\/[a-z0-9]+)?$/);
    await page.goto("/kk/teacher/review");
    await expect(page).toHaveURL(/\/kk\/parent(\/child\/[a-z0-9]+)?$/);
  });
});
