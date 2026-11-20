import { expect, test } from "@playwright/test";
import { e2eDb, loginAs } from "./helpers";

test.describe("student city (Stage 4)", () => {
  test("a new student sees an empty city with 8 lots (spec §13 step 1, acceptance #2)", async ({ page }) => {
    await loginAs(page, "timur");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await expect(page.locator(".iso-city .plot:not(.plot--square)")).toHaveCount(8);
    await expect(page.locator(".iso-city .iso-ghost")).toHaveCount(8); // every lot shows a ghost of its future building
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  test("buildings match the stored levels; selecting one opens its panel and page", async ({ page }) => {
    await loginAs(page, "aruzhan");
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "45");

    await page.locator('.plot[data-key="grammar"]').click();
    await expect(page.locator('.plot[data-key="grammar"]')).toHaveClass(/is-selected/);
    await expect(page.getByRole("heading", { name: "Грамматика сарайы" })).toBeVisible();
    await expect(page.getByText("7/10")).toBeVisible();

    await page.getByRole("link", { name: /Тапсырмаларды ашу/ }).click();
    await expect(page).toHaveURL(/\/kk\/student\/building\/grammar$/);
    await expect(page.getByText("Н или НН?")).toBeVisible();
    await expect(page.getByText("2 → 3 деңгей · 7 балл")).toBeVisible(); // retake raised the palace (spec §13)
  });

  test("the building list works without the map (keyboard / screen readers)", async ({ page }) => {
    await loginAs(page, "aruzhan");
    await page.getByRole("button", { name: /Сөздер мұнарасы/ }).click();
    await expect(page.getByRole("heading", { name: "Сөздер мұнарасы" })).toBeVisible();
    await expect(page.locator('.plot[data-key="tower"]')).toHaveClass(/is-selected/);
  });

  test("a new level-up plays the build animation once", async ({ page }) => {
    const db = e2eDb();
    await db.execute(
      "UPDATE Notification SET readAt = NULL WHERE type = 'LEVEL_UP' AND recipientId = (SELECT id FROM User WHERE login = 'aruzhan')",
    );
    db.close();

    await loginAs(page, "aruzhan");
    await expect(page.locator(".is-rising")).toHaveCount(1);
    await expect(page.locator('[role="status"]')).toContainText("деңгейге көтерілді");

    await expect(page.locator(".is-rising")).toHaveCount(0, { timeout: 6000 }); // animation queue finished
    await page.waitForTimeout(500); // let markLevelUpsSeen() finish
    await page.reload();
    await expect(page.locator(".iso-city")).toBeVisible();
    await expect(page.locator(".is-rising")).toHaveCount(0);
  });

  test("the student renames the city and the name persists", async ({ page }) => {
    await loginAs(page, "alina");
    await page.getByRole("button", { name: "Қала атауын өзгерту" }).click();
    await page.getByRole("textbox", { name: "Қала атауы" }).fill("Жаңа <Алина>");
    await page.getByRole("button", { name: "Сақтау" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("«Жаңа <Алина>»");

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("«Жаңа <Алина>»");
    await expect(page.locator(".plot--square text")).toHaveText("Жаңа <Алина>"); // escaped, rendered as text
  });

  test("zoom buttons scale the map", async ({ page }) => {
    await loginAs(page, "aruzhan");
    await page.getByRole("button", { name: "Үлкейту" }).click();
    await expect(page.locator(".city-host svg")).toHaveAttribute("style", /scale\(1\.3\)/);
    await page.getByRole("button", { name: "Бастапқы көрініс" }).click();
    await expect(page.locator(".city-host svg")).toHaveAttribute("style", /scale\(1\)/);
  });

  test("a locked building explains how to open it", async ({ page }) => {
    await loginAs(page, "timur");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await page.goto("/kk/student/building/townhall");
    await expect(page.getByText("Бұл ғимарат әзірге жабық")).toBeVisible();
  });

  test("an unknown building is a 404", async ({ page }) => {
    await loginAs(page, "timur");
    await expect(page).toHaveURL(/\/kk\/student$/);
    const res = await page.goto("/kk/student/building/castle");
    expect(res?.status()).toBe(404);
  });
});
