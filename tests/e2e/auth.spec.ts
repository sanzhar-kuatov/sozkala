import { expect, test } from "@playwright/test";
import { e2eDb, formAlert, loginAs, logout } from "./helpers";

test.describe("authentication & roles (Stage 3)", () => {
  test("signed-out visitors are sent to login and back after signing in", async ({ page }) => {
    await page.goto("/kk/student/rewards");
    await expect(page).toHaveURL(/\/kk\/login\?next=%2Fstudent%2Frewards$/);

    await page.locator("#login").fill("aruzhan");
    await page.locator("#password").fill("demo12345");
    await page.locator('form button[type="submit"]').first().click();
    await expect(page).toHaveURL(/\/kk\/student\/rewards$/);
  });

  test("student logs in, progress session survives reload, logs out (acceptance #5)", async ({ page }) => {
    await loginAs(page, "aruzhan");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await expect(page.getByText("Аружан Қасымова")).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/kk\/student$/);

    await logout(page);
    await page.goto("/kk/student");
    await expect(page).toHaveURL(/\/kk\/login/);
  });

  test("wrong password shows an error and stays on login", async ({ page }) => {
    await loginAs(page, "aruzhan", "wrong-password");
    await expect(formAlert(page)).toBeVisible();
    await expect(page).toHaveURL(/\/kk\/login/);
  });

  test("each role only reaches its own cabinet", async ({ page }) => {
    await loginAs(page, "aruzhan");
    await expect(page).toHaveURL(/\/kk\/student$/);
    for (const other of ["/kk/teacher", "/kk/parent", "/kk/admin/users"]) {
      await page.goto(other);
      await expect(page).toHaveURL(/\/kk\/student$/);
    }
  });

  test("parent lands in the parent cabinet and cannot open the student cabinet (acceptance #6)", async ({ page }) => {
    await loginAs(page, "parent");
    await expect(page).toHaveURL(/\/kk\/parent(\/child\/[a-z0-9]+)?$/);
    await page.goto("/kk/student");
    await expect(page).toHaveURL(/\/kk\/parent(\/child\/[a-z0-9]+)?$/);
  });

  test("teacher and admin land in their cabinets", async ({ page }) => {
    await loginAs(page, "teacher");
    await expect(page).toHaveURL(/\/kk\/teacher$/);
    await logout(page);
    await loginAs(page, "admin", "admin12345");
    await expect(page).toHaveURL(/\/kk\/admin$/);
  });

  test("deactivating an account ends its session immediately", async ({ page }) => {
    await loginAs(page, "damir");
    await expect(page).toHaveURL(/\/kk\/student$/);

    const db = e2eDb();
    await db.execute("UPDATE User SET isActive = 0 WHERE login = 'damir'");
    await page.reload();
    await expect(page).toHaveURL(/\/kk\/login/);

    await loginAs(page, "damir");
    await expect(formAlert(page)).toBeVisible(); // "account is blocked"
    await db.execute("UPDATE User SET isActive = 1 WHERE login = 'damir'");
    db.close();
  });

  test("five wrong passwords lock the login for 15 minutes", async ({ page }) => {
    for (let i = 0; i < 5; i++) await loginAs(page, "madina", `wrong-${i}`);
    await loginAs(page, "madina"); // correct password, but locked
    await expect(formAlert(page)).toContainText("15");
    await expect(page).toHaveURL(/\/kk\/login/);

    // Unlock again so later specs can use this account.
    const db = e2eDb();
    await db.execute("DELETE FROM AuditLog WHERE action = 'auth.login.failed' AND entityId = 'madina'");
    db.close();
  });
});

test.describe("registration with a class invite code", () => {
  test("a new student registers, gets an empty city and is signed in", async ({ page }) => {
    await page.goto("/kk/join/soz7a1"); // case-insensitive
    await expect(page.getByText("7«Ә»")).toBeVisible();

    await page.locator("#firstName").fill("Ерлан");
    await page.locator("#lastName").fill("Нұрланов");
    await page.locator("#login").fill("erlan.n");
    await page.locator("#password").fill("secret123");
    await page.locator("#confirm").fill("secret123");
    // without consent nothing is created (personal data law)
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('form [role="alert"]')).toContainText("келісім");
    await page.locator('input[name="consent"]').check();
    await page.locator("#password").fill("secret123");
    await page.locator("#confirm").fill("secret123");
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/kk\/student$/);
    await expect(page.getByText("Ерлан Нұрланов")).toBeVisible();

    const db = e2eDb();
    const res = await db.execute(
      "SELECT c.name, COUNT(b.id) AS lots, SUM(b.level) AS levels FROM City c JOIN User u ON u.id = c.studentId JOIN BuildingProgress b ON b.cityId = c.id WHERE u.login = 'erlan.n' GROUP BY c.id",
    );
    db.close();
    expect(res.rows[0]).toMatchObject({ name: "Ерлан-қала", lots: 8, levels: 0 });
  });

  test("validation errors are shown next to the fields", async ({ page }) => {
    await page.goto("/kk/join/SOZ7A1");
    await page.locator("#firstName").fill("Тест");
    await page.locator("#lastName").fill("Тестов");
    await page.locator("#login").fill("aruzhan"); // taken
    await page.locator("#password").fill("short");
    await page.locator("#confirm").fill("other");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('[id="password-hint"]')).toBeVisible();
    await expect(page.locator('[id="confirm-hint"]')).toBeVisible();
    await expect(page).toHaveURL(/\/kk\/join\/SOZ7A1$/);
  });

  test("an unknown code shows a friendly error", async ({ page }) => {
    await page.goto("/kk/join/NOPE00");
    await expect(page.getByRole("heading", { name: "Шақыру коды табылмады" })).toBeVisible();
  });
});
