import { expect, type Page, test } from "@playwright/test";
import { formAlert, loginAs, sql } from "./helpers";

/**
 * Stage 12 — admin cabinet (spec §2.4). Shared demo accounts are never changed
 * here; the users this spec creates are its own, and settings are restored.
 */
const ADMIN_PASSWORD = "admin12345";

async function asAdmin(page: Page) {
  await loginAs(page, "admin", ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/kk\/admin$/);
}

/** Reads the one-time credentials card. */
async function credentials(page: Page) {
  const card = page.getByRole("status").filter({ hasText: "Құпиясөз" });
  await expect(card).toBeVisible();
  const values = card.locator("dd");
  return { login: (await values.nth(0).innerText()).trim(), password: (await values.nth(1).innerText()).trim() };
}

test.describe("admin cabinet (Stage 12)", () => {
  test("the overview shows platform numbers and links", async ({ page }) => {
    await asAdmin(page);
    await expect(page.getByRole("heading", { level: 1, name: "Платформа күйі" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Оқушылар" }).first()).toBeVisible();
    await expect(page.getByText("Соңғы әрекеттер")).toBeVisible();
  });

  test("users: search, create a teacher, reset the password, deactivate", async ({ page, browser }) => {
    await asAdmin(page);
    await page.goto("/kk/admin/users?q=aruzhan");
    await expect(page.getByText("Табылды: 1")).toBeVisible();
    await expect(page.getByRole("link", { name: "Қасымова Аружан" })).toBeVisible();

    await page.goto("/kk/admin/users");
    const create = page.locator("form", { has: page.getByRole("button", { name: "Құру" }) });
    await create.getByLabel("Рөлі").selectOption("TEACHER");
    await create.getByLabel("Тегі").fill("Тестова");
    await create.getByLabel("Аты", { exact: true }).fill("Сая");
    await create.getByLabel("Логин (міндетті емес)").fill("e2e.saya");
    await create.getByRole("button", { name: "Құру" }).click();
    const first = await credentials(page);
    expect(first.login).toBe("e2e.saya");

    // the new account works
    const other = await browser.newPage();
    await loginAs(other, first.login, first.password);
    await expect(other).toHaveURL(/\/kk\/teacher$/);

    // reset → the old password stops working and the user is signed out
    await page.goto("/kk/admin/users?q=e2e.saya");
    await page.getByRole("link", { name: "Тестова Сая" }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Құпиясөзді қалпына келтіру" }).click();
    const second = await credentials(page);
    expect(second.password).not.toBe(first.password);
    await other.reload();
    await expect(other).toHaveURL(/\/kk\/login/);

    // deactivate → cannot sign in
    await page.reload();
    await page.getByLabel("Белсенді").uncheck();
    await page.getByRole("button", { name: "Сақтау" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Сақталды" })).toBeVisible();
    await loginAs(other, second.login, second.password);
    await expect(formAlert(other)).toContainText("Аккаунт бұғатталған");
    await other.close();

    // the admin cannot demote or lock themselves
    const [{ id }] = await sql("SELECT id FROM User WHERE login = 'admin'");
    await page.goto(`/kk/admin/users/${id}`);
    await expect(page.getByLabel("Рөлі")).toBeDisabled();
    await expect(page.getByLabel("Белсенді")).toBeDisabled();
  });

  test("a parent account is linked to a student by login", async ({ page }) => {
    await asAdmin(page);
    await page.goto("/kk/admin/users");
    const create = page.locator("form", { has: page.getByRole("button", { name: "Құру" }) });
    await create.getByLabel("Рөлі").selectOption("PARENT");
    await create.getByLabel("Тегі").fill("Жақсылықова");
    await create.getByLabel("Аты", { exact: true }).fill("Гүлнар");
    await create.getByLabel("Логин (міндетті емес)").fill("e2e.gulnar");
    await create.getByRole("button", { name: "Құру" }).click();
    const parent = await credentials(page);

    await page.goto("/kk/admin/users?q=e2e.gulnar");
    await page.getByRole("link", { name: "Жақсылықова Гүлнар" }).click();
    await page.getByLabel("Оқушының логині").fill("nobody-here");
    await page.getByRole("button", { name: "Байланыстыру" }).click();
    await expect(formAlert(page)).toContainText("оқушы табылмады");
    await page.getByLabel("Оқушының логині").fill("timur");
    await page.getByRole("button", { name: "Байланыстыру" }).click();
    await expect(page.getByRole("link", { name: /Жақсылықов Тимур/ })).toBeVisible();

    await page.context().clearCookies();
    await loginAs(page, parent.login, parent.password);
    await expect(page).toHaveURL(/\/kk\/parent\/child\/[a-z0-9]+$/);
    await expect(page.getByRole("heading", { level: 1, name: "Тимур Жақсылықов" })).toBeVisible();
  });

  test("schools: create, rename, and delete an empty one", async ({ page }) => {
    await asAdmin(page);
    await page.goto("/kk/admin/schools");
    const create = page.locator("form", { has: page.getByRole("button", { name: "Қосу" }) });
    await create.getByLabel("Атауы").fill("E2E мектебі");
    await create.getByLabel("Қала").fill("Астана");
    await create.getByRole("button", { name: "Қосу" }).click();

    const card = page.locator("li", { has: page.locator('input[value="E2E мектебі"]') });
    await expect(card).toBeVisible();
    await card.getByLabel("Атауы").fill("E2E мектебі 2");
    await card.getByRole("button", { name: "Сақтау" }).click();
    const renamed = page.locator("li", { has: page.locator('input[value="E2E мектебі 2"]') });
    await expect(renamed).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await renamed.getByRole("button", { name: "Жою" }).click();
    await expect(renamed).toHaveCount(0);
    // the demo school has people → no delete button
    await expect(
      page
        .locator("li", { has: page.locator('input[value="Демо мектеп-гимназиясы"]') })
        .getByRole("button", { name: "Жою" }),
    ).toHaveCount(0);
  });

  test("settings are enforced: closing registration closes /join", async ({ page }) => {
    await asAdmin(page);
    await page.goto("/kk/admin/settings");
    await page.getByLabel(/Шақыру коды арқылы тіркелу/).uncheck();
    await page.getByRole("button", { name: "Сақтау" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Сақталды" })).toBeVisible();

    await page.goto("/kk/join/SOZ7A1");
    await expect(page.getByRole("heading", { name: "Тіркелу жабық" })).toBeVisible();
    await expect(page.locator("form #login")).toHaveCount(0);

    // restore (shared database)
    await page.goto("/kk/admin/settings");
    await page.getByLabel(/Шақыру коды арқылы тіркелу/).check();
    await page.getByRole("button", { name: "Сақтау" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Сақталды" })).toBeVisible();
    await page.goto("/kk/join/SOZ7A1");
    await expect(page.getByRole("heading", { name: "Тіркелу жабық" })).toHaveCount(0);
  });

  test("the catalogue refuses a city without main buildings", async ({ page }) => {
    await asAdmin(page);
    await page.goto("/kk/admin/buildings");
    const form = page.locator("form", { has: page.locator('input[name="core_grammar"]') });
    for (const box of await form.locator('input[type="checkbox"]').all()) await box.uncheck();
    await form.getByRole("button", { name: "Сақтау" }).click();
    await expect(formAlert(page)).toContainText("Кемінде бір негізгі ғимарат");
    await page.reload();
    await expect(form.locator('input[type="checkbox"]:checked')).toHaveCount(8); // nothing was saved
  });

  test("the audit log records admin actions and the error journal opens", async ({ page }) => {
    await asAdmin(page);
    await page.goto("/kk/admin/logs?action=user.create");
    await expect(page.locator("tbody tr").first()).toContainText("user.create");
    await expect(page.locator("tbody tr").first()).toContainText("admin");
    await page.getByRole("link", { name: "Қателер" }).click();
    await expect(page).toHaveURL(/tab=errors/);
    await expect(page.getByText(/Қателер: \d+/)).toBeVisible();
  });

  test("backups: create, download (admins only), delete", async ({ page, browser }) => {
    await asAdmin(page);
    await page.goto("/kk/admin/backups");
    await page.getByRole("button", { name: "Қазір көшірме жасау" }).click();
    const link = page.getByRole("link", { name: "Жүктеу" }).first();
    await expect(link).toBeVisible();
    const href = (await link.getAttribute("href"))!;
    expect(href).toMatch(/^\/api\/admin\/backups\/sozqala-\d{8}-\d{6}(-\d+)?\.db$/);

    const res = await page.request.get(href);
    expect(res.status()).toBe(200);
    expect((await res.body()).subarray(0, 15).toString()).toBe("SQLite format 3");

    const teacher = await browser.newPage();
    await loginAs(teacher, "teacher");
    await expect(teacher).toHaveURL(/\/kk\/teacher/);
    expect((await teacher.request.get(href)).status()).toBe(404);
    expect((await teacher.request.get("/api/admin/backups/..%2F..%2Fprisma%2Fe2e.db")).status()).toBe(404);
    await teacher.goto("/kk/admin/backups");
    await expect(teacher).toHaveURL(/\/kk\/teacher/); // not the admin cabinet
    await teacher.close();

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Жою" }).first().click();
    await expect(page.getByText("Әлі көшірме жоқ.")).toBeVisible();
  });
});
