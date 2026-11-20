import { expect, test, type Page } from "@playwright/test";
import { e2eDb, loginAs } from "./helpers";

/** Opens a task from its building page and presses Start / Retake. */
async function startTask(page: Page, building: string, title: string) {
  await page.goto(`/kk/student/building/${building}`);
  const card = page.locator("li", { hasText: title });
  await card.getByRole("link", { name: /Бастау|Қайта орындау|Жалғастыру/ }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const start = page.getByRole("button", { name: /Бастау|Қайта орындау/ });
  if (await start.isVisible()) await start.click();
  // the player is on screen when its navigation button is
  await expect(page.getByRole("button", { name: /Келесі|Тапсыру/ })).toBeVisible();
}

const choose = (page: Page, text: string) => page.getByText(text, { exact: true }).click();
const next = (page: Page) => page.getByRole("button", { name: "Келесі" }).click();
const submit = (page: Page) => page.getByRole("button", { name: "Тапсыру" }).click();
const sql = async (query: string) => {
  const db = e2eDb();
  const res = await db.execute(query);
  db.close();
  return res;
};

test.describe("task player (Stage 5)", () => {
  test("all answers right → 10/10 and every question marked correct", async ({ page }) => {
    await loginAs(page, "timur");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await startTask(page, "park", "Средства выразительности");

    for (const [i, answer] of ["олицетворение", "эпитет", "сравнение", "гипербола"].entries()) {
      await expect(page.getByText(`Сұрақ ${i + 1} / 4`)).toBeVisible();
      await choose(page, answer);
      if (i < 3) await next(page);
    }
    await submit(page);

    await expect(page).toHaveURL(/\/result\//);
    await expect(page.getByRole("img", { name: "10/10" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Керемет!" })).toBeVisible();
    await expect(page.locator("ol li svg.text-grass-700")).toHaveCount(4);
  });

  test("partial answers → partial score; correct answers stay hidden while attempts remain", async ({ page }) => {
    await loginAs(page, "timur");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await startTask(page, "tower", "Синонимы, антонимы, значение слова");
    await choose(page, "храбрый"); // right
    await next(page);
    await choose(page, "добрый"); // wrong (скупой)
    await next(page);
    await submit(page); // third question unanswered → confirmation
    await expect(page.getByRole("dialog")).toContainText("1 сұраққа жауап берілмеген");
    await page.getByRole("button", { name: "Иә, тапсыру" }).click();

    await expect(page.getByRole("img", { name: "3.3/10" })).toBeVisible();
    await expect(page.getByText("Дұрыс жауаптар соңғы әрекеттен кейін көрсетіледі")).toBeVisible();
    await expect(page.getByText("Дұрыс жауап:")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Қайта орындау" })).toBeVisible();
  });

  test("answers are autosaved and survive a reload", async ({ page }) => {
    await loginAs(page, "madina");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await startTask(page, "bridge", "Составьте предложение");
    for (const word of ["Ранней", "осенью", "лес", "становится", "золотым."]) {
      await page.getByRole("button", { name: word, exact: true }).click();
    }
    await expect(page.getByText("Сақталды")).toBeVisible({ timeout: 5000 });

    await page.reload();
    await expect(page.getByText("1/2 жауап")).toBeVisible();
    await next(page);
    for (const word of ["После", "уроков", "мы", "пошли", "в", "библиотеку."]) {
      await page.getByRole("button", { name: word, exact: true }).click();
    }
    await submit(page);
    await expect(page.getByRole("img", { name: "10/10" })).toBeVisible();
  });

  test("an essay goes to the teacher and blocks a new attempt until reviewed", async ({ page }) => {
    await loginAs(page, "timur");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await startTask(page, "academy", "Эссе «Мой любимый литературный герой»");
    await page.getByRole("textbox").fill("Мой любимый герой — Пётр Гринёв. Он честный и смелый.");
    await expect(page.getByText("9 сөз")).toBeVisible();
    await submit(page);

    await expect(page.getByRole("heading", { name: "Мұғалімге жіберілді" })).toBeVisible();
    await expect(page.getByText("Пётр Гринёв")).toBeVisible();

    await page.goto("/kk/student/building/academy");
    await expect(page.locator("li", { hasText: "Мой любимый" }).getByText("Тексерілуде")).toBeVisible();
    await page
      .locator("li", { hasText: "Мой любимый" })
      .getByRole("link", { name: /Бастау|Қайта/ })
      .click();
    await expect(page.getByText("Алдыңғы жұмысыңыз мұғалімде тексерілуде.")).toBeVisible();
  });

  test("after the last attempt the correct answers are shown and no retake is offered", async ({ page }) => {
    await sql("UPDATE Task SET maxAttempts = 1 WHERE title = 'Виды сложных предложений'");
    await loginAs(page, "madina");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await startTask(page, "bridge", "Виды сложных предложений");
    for (let i = 0; i < 3; i++) {
      await choose(page, "бессоюзное");
      if (i < 2) await next(page);
    }
    await submit(page);

    await expect(page.getByRole("img", { name: "3.3/10" })).toBeVisible();
    await expect(page.getByText("Дұрыс жауап:").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Қайта орындау" })).toHaveCount(0);

    await page.goto("/kk/student/building/bridge");
    await page.locator("li", { hasText: "Виды сложных" }).getByRole("link", { name: /Қайта/ }).click();
    await expect(page.getByText("Әрекеттер таусылды.")).toBeVisible();
  });

  test("when time runs out the answers are submitted automatically", async ({ page }) => {
    await sql("UPDATE Task SET timeLimitSec = 4 WHERE title = 'ПРЕ- или ПРИ-?'");
    await loginAs(page, "damir");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await startTask(page, "grammar", "ПРЕ- или ПРИ-?");
    await page.getByRole("textbox", { name: "1-бос орын" }).fill("е");
    await expect(page).toHaveURL(/\/result\//, { timeout: 15_000 });
    await expect(page.getByRole("img", { name: /\/10$/ })).toBeVisible();
  });

  test("the answer key never reaches the browser", async ({ page }) => {
    await loginAs(page, "alina");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await startTask(page, "tower", "Фразеологизмы");
    const html = await page.content();
    expect(html).toContain("бить баклуши");
    expect(html).not.toContain('"pairs"');
    expect(html).not.toMatch(/f1\\?":\\?"m2/); // the pair f1→m2 from the key
  });

  test("an unknown or unassigned task is a 404", async ({ page }) => {
    await loginAs(page, "timur");
    await expect(page).toHaveURL(/\/kk\/student$/);
    const res = await page.goto("/kk/student/task/not-a-task");
    expect(res?.status()).toBe(404);
  });

  test("recordings are not served without permission", async ({ request }) => {
    const res = await request.get("/api/files/audio/abc-123456789abc.webm");
    expect(res.status()).toBe(401);
  });
});
