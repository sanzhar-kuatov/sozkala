import { expect, test, type Page } from "@playwright/test";
import { loginAs, sql } from "./helpers";

const balance = async (login: string) =>
  (
    await sql("SELECT c.points, c.materials, c.stars FROM City c JOIN User u ON u.id = c.studentId WHERE u.login = ?", [
      login,
    ])
  )[0] as unknown as { points: number; materials: number; stars: number };

async function solveSynonyms(page: Page) {
  await page.goto("/kk/student/building/tower");
  await page
    .locator("li", { hasText: "Синонимы, антонимы" })
    .getByRole("link", { name: /Бастау|Қайта орындау/ })
    .click();
  await page.getByRole("button", { name: /Бастау|Қайта орындау/ }).click();
  for (const [i, a] of ["храбрый", "скупой", "однообразная привычная работа"].entries()) {
    await page.getByText(a, { exact: true }).click();
    if (i < 2) await page.getByRole("button", { name: "Келесі" }).click();
  }
  await page.getByRole("button", { name: "Тапсыру" }).click();
  await expect(page.getByRole("img", { name: "10/10" })).toBeVisible();
}

test.describe("rewards & decorations (Stage 8)", () => {
  test("a perfect first attempt pays points, materials and a star — a retake pays nothing", async ({ page }) => {
    const before = await balance("madina");
    await loginAs(page, "madina");
    await expect(page).toHaveURL(/\/kk\/student$/);

    await solveSynonyms(page); // tower: empty lot → L5 (5 levels)
    await expect(page.getByText("+100 ұпай")).toBeVisible();
    await expect(page.getByText("+25 материал")).toBeVisible();
    await expect(page.getByText("+1 жұлдыз")).toBeVisible();
    await expect(page.getByText("Жаңа белгі: Мінсіз ондық")).toBeVisible();
    expect(await balance("madina")).toEqual({
      points: before.points + 100,
      materials: before.materials + 25,
      stars: before.stars + 1,
    });

    await solveSynonyms(page); // same score again
    await expect(page.getByText("+100 ұпай")).toHaveCount(0);
    expect(await balance("madina")).toEqual({
      points: before.points + 100,
      materials: before.materials + 25,
      stars: before.stars + 1,
    });
  });

  test("buy a fountain, place it on a street and take it back", async ({ page }) => {
    const before = await balance("aruzhan");
    expect(before.materials).toBeGreaterThanOrEqual(40);
    await loginAs(page, "aruzhan");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await page.goto("/kk/student/rewards");

    await page.getByRole("button", { name: "Субұрқақ сатып алу" }).click();
    await expect(page.getByRole("button", { name: "Субұрқақ", exact: true })).toBeVisible(); // in the inventory
    expect((await balance("aruzhan")).materials).toBe(before.materials - 40);

    await page.getByRole("button", { name: "Субұрқақ", exact: true }).click();
    await expect(page.locator(".deco-slot")).toHaveCount(40);
    await page.locator('.deco-slot[data-slot="5"]').click();
    await expect(page.locator(".iso-city .deco")).toHaveCount(1);

    // visible on the home city too
    await page.goto("/kk/student");
    await expect(page.locator(".iso-city .deco")).toHaveCount(1);

    // take it back to the inventory
    await page.goto("/kk/student/rewards");
    await page.getByRole("button", { name: "Алып тастау" }).click();
    await page.locator(".iso-city .deco").first().click();
    await expect(page.locator(".iso-city .deco")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Субұрқақ", exact: true })).toBeVisible();
  });

  test("not enough materials → nothing is bought", async ({ page }) => {
    await sql("UPDATE City SET materials = 3 WHERE studentId = (SELECT id FROM User WHERE login = 'damir')");
    await loginAs(page, "damir");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await page.goto("/kk/student/rewards");
    await expect(page.getByRole("button", { name: "Шам сатып алу" })).toBeDisabled();
    expect((await balance("damir")).materials).toBe(3);
  });

  test("badges show what is earned and what is still locked", async ({ page }) => {
    await loginAs(page, "aruzhan");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await page.goto("/kk/student/rewards");
    // Аружан: first building, a perfect 10 (park) and an improved retake (Н/НН 5 → 7)
    await expect(page.getByRole("heading", { name: "Жетістік белгілері (3/6)" })).toBeVisible();
    await expect(page.locator("li", { hasText: "Сөзқаланың бас сәулетшісі" }).getByText("Әлі алынбаған")).toBeVisible();
  });
});
