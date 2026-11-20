import { expect, test } from "@playwright/test";
import { loginAs, logout, sql } from "./helpers";

const idOf = async (login: string) =>
  ((await sql("SELECT id FROM User WHERE login = ?", [login]))[0] as unknown as { id: string }).id;

test.describe("parent cabinet & notifications (Stage 9)", () => {
  test("the parent lands on their child's page with city, results and difficult topics", async ({ page }) => {
    const aruzhan = await idOf("aruzhan");
    await loginAs(page, "parent");
    await expect(page).toHaveURL(new RegExp(`/kk/parent/child/${aruzhan}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Аружан Қасымова" })).toBeVisible();
    await expect(page.getByText("Тек қарау режимі")).toBeVisible();
    await expect(page.locator(".iso-city .plot:not(.plot--square)")).toHaveCount(8);
    // Аружан scored 2/10 on commas → "Сложное предложение" is a difficult topic
    await expect(page.locator("li", { hasText: "Сложное предложение" }).getByText("2/10")).toBeVisible();
    await expect(page.getByText("Қаланың даму тарихы")).toBeVisible();
  });

  test("acceptance #6: a parent cannot open another child's page", async ({ page }) => {
    const damir = await idOf("damir");
    await loginAs(page, "parent");
    await expect(page).toHaveURL(/\/kk\/parent\/child\//);
    const res = await page.goto(`/kk/parent/child/${damir}`);
    expect(res?.status()).toBe(404);
  });

  test("acceptance #7: the parent cabinet has no way to do tasks or change grades", async ({ page }) => {
    await loginAs(page, "parent");
    await expect(page).toHaveURL(/\/kk\/parent\/child\//);
    // the only form on the page is logout
    await expect(page.locator("main form")).toHaveCount(0);
    for (const path of ["/kk/student", "/kk/student/building/grammar", "/kk/teacher/review"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/kk\/parent/);
    }
  });

  test("spec §8 messages appear in the feed and the bell count drops once read", async ({ page }) => {
    await loginAs(page, "parent");
    await expect(page).toHaveURL(/\/kk\/parent\/child\//);
    const bell = page.getByRole("link", { name: /Хабарламалар, оқылмаған/ });
    await expect(bell).toContainText(/\d/);

    await bell.click();
    await expect(page).toHaveURL(/\/kk\/parent\/notifications$/);
    await expect(page.getByText("Балаңыз жаңа ғимарат салды!").first()).toBeVisible();
    await expect(page.getByText(/тақырыбы бойынша нәтиже: \d+(\.\d)?\/10/).first()).toBeVisible();
    await expect(page.getByText(/Қаланы аяқтауға \d+% қалды/)).toBeVisible();

    await page.waitForTimeout(2500); // marked as read after a short delay
    await page.reload();
    await expect(page.getByRole("link", { name: "Хабарламалар, оқылмаған: 0" })).toBeVisible();
  });

  test("when the child builds a new building, the parent is told (spec §8)", async ({ page }) => {
    // Дамир's theatre is an empty lot; his father is parent2.
    await loginAs(page, "damir");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await page.goto("/kk/student/building/theatre");
    await page.locator("li", { hasText: "Узнай героя" }).getByRole("link", { name: "Бастау" }).click();
    await page.getByRole("button", { name: "Бастау" }).click();
    for (const [i, name] of ["Савельич", "Пётр Гринёв", "Алексей Швабрин", "Емельян Пугачёв"].entries()) {
      await page.getByText(name, { exact: true }).click();
      if (i < 3) await page.getByRole("button", { name: "Келесі" }).click();
    }
    await page.getByRole("button", { name: "Тапсыру" }).click();
    await expect(page.getByRole("img", { name: "10/10" })).toBeVisible();

    await logout(page);
    await loginAs(page, "parent2");
    await expect(page).toHaveURL(/\/kk\/parent\/child\//);
    await page.goto("/kk/parent/notifications");
    const item = page
      .locator("li", { hasText: "Балаңыз жаңа ғимарат салды!" })
      .filter({ hasText: "Кейіпкерлер театры" });
    await expect(item).toBeVisible();
    await expect(item).toContainText("Дамир Серікұлы");
  });

  test("teachers are notified about work to review", async ({ page }) => {
    await loginAs(page, "teacher");
    await expect(page).toHaveURL(/\/kk\/teacher$/);
    await page.goto("/kk/teacher/notifications");
    await expect(page.getByText("Жаңа жұмыс тексеруді күтуде").first()).toBeVisible();
    await page.getByText("Жаңа жұмыс тексеруді күтуде").first().click();
    await expect(page).toHaveURL(/\/kk\/teacher\/review\//);
  });
});
