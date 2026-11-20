import { expect, test } from "@playwright/test";
import { formAlert, loginAs, sql } from "./helpers";

/** Stage 13 — security headers, personal-data notice and consent, right to erasure (spec §11). */
test.describe("security & personal data (Stage 13)", () => {
  test("pages carry security headers and a fresh CSP nonce per request", async ({ request }) => {
    const nonces: string[] = [];
    for (let i = 0; i < 2; i++) {
      const res = await request.get("/kk/login");
      const h = res.headers();
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["permissions-policy"]).toContain("microphone=(self)");
      expect(h["x-powered-by"]).toBeUndefined();
      const csp = h["content-security-policy"];
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      nonces.push(/'nonce-([^']+)'/.exec(csp)![1]);
      // Next.js put the nonce on its scripts
      expect(await res.text()).toContain(`nonce="${nonces[i]}"`);
    }
    expect(nonces[0]).not.toBe(nonces[1]);
  });

  test("the app still works under the CSP (no violations while signing in and using the city)", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && /Content Security Policy/i.test(m.text())) violations.push(m.text());
    });
    await loginAs(page, "aruzhan");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await page.locator('.plot[data-key="grammar"]').click(); // client-side interactivity works
    await expect(page.getByRole("heading", { name: "Грамматика сарайы" })).toBeVisible();
    expect(violations).toEqual([]);
  });

  test("the personal-data notice is public and linked from the login page", async ({ page }) => {
    await page.goto("/kk/login");
    await page.getByRole("link", { name: "Дербес деректер" }).click();
    await expect(page).toHaveURL(/\/kk\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: "Дербес деректерді өңдеу туралы" })).toBeVisible();
    await expect(page.getByText("94-V")).toBeVisible();
    await page.goto("/ru/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Об обработке персональных данных" })).toBeVisible();
  });

  test("an admin deletes a student with all their data; authors of content are refused", async ({ page }) => {
    await loginAs(page, "admin", "admin12345");
    await expect(page).toHaveURL(/\/kk\/admin$/);

    // a throwaway student with a city
    await page.goto("/kk/admin/users");
    const create = page.locator("form", { has: page.getByRole("button", { name: "Құру" }) });
    await create.getByLabel("Рөлі").selectOption("STUDENT");
    await create.getByLabel("Тегі").fill("Өшірілетін");
    await create.getByLabel("Аты", { exact: true }).fill("Оқушы");
    await create.getByLabel("Логин (міндетті емес)").fill("e2e.erase");
    await create.getByRole("button", { name: "Құру" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Құпиясөз" })).toBeVisible();
    const [{ id }] = await sql("SELECT id FROM User WHERE login = 'e2e.erase'");
    expect(await sql("SELECT id FROM City WHERE studentId = ?", [String(id)])).toHaveLength(1);

    await page.goto(`/kk/admin/users/${id}`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Аккаунтты жою" }).click();
    await expect(page).toHaveURL(/\/kk\/admin\/users$/);
    expect(await sql("SELECT id FROM User WHERE id = ?", [String(id)])).toHaveLength(0);
    expect(await sql("SELECT id FROM City WHERE studentId = ?", [String(id)])).toHaveLength(0);
    // the audit entry keeps no personal data
    const [entry] = await sql("SELECT data FROM AuditLog WHERE action = 'user.delete' AND entityId = ?", [String(id)]);
    expect(String(entry.data)).not.toContain("Өшірілетін");

    // the demo teacher authored classes and tasks → refused, nothing deleted
    const [{ id: teacherId }] = await sql("SELECT id FROM User WHERE login = 'teacher'");
    await page.goto(`/kk/admin/users/${teacherId}`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Аккаунтты жою" }).click();
    await expect(formAlert(page)).toContainText("тапсырмалар немесе сыныптар");
    expect(await sql("SELECT id FROM User WHERE login = 'teacher'")).toHaveLength(1);
  });

  test("any user replaces a temporary password on their account page", async ({ page }) => {
    // a fresh parent account (parents can change their own password even though they are read-only)
    await loginAs(page, "admin", "admin12345");
    await expect(page).toHaveURL(/\/kk\/admin$/);
    await page.goto("/kk/admin/users");
    const create = page.locator("form", { has: page.getByRole("button", { name: "Құру" }) });
    await create.getByLabel("Рөлі").selectOption("PARENT");
    await create.getByLabel("Тегі").fill("Құпиясөзова");
    await create.getByLabel("Аты", { exact: true }).fill("Дана");
    await create.getByLabel("Логин (міндетті емес)").fill("e2e.pw");
    await create.getByRole("button", { name: "Құру" }).click();
    const card = page.getByRole("status").filter({ hasText: "Құпиясөз" });
    const temp = (await card.locator("dd").nth(1).innerText()).trim();
    await page.context().clearCookies();

    await loginAs(page, "e2e.pw", temp);
    await expect(page).toHaveURL(/\/kk\/parent/);
    await page.getByRole("link", { name: /^Менің аккаунтым/ }).click();
    await expect(page).toHaveURL(/\/kk\/account$/);
    await page.getByLabel("Қазіргі құпиясөз").fill("wrong-password");
    await page.getByLabel("Жаңа құпиясөз", { exact: true }).fill("new-secret-123");
    await page.getByLabel("Жаңа құпиясөзді қайталаңыз").fill("new-secret-123");
    await page.getByRole("button", { name: "Құпиясөзді өзгерту" }).click();
    await expect(formAlert(page)).toContainText("Қазіргі құпиясөз қате");

    await page.getByLabel("Қазіргі құпиясөз").fill(temp);
    await page.getByLabel("Жаңа құпиясөз", { exact: true }).fill("new-secret-123");
    await page.getByLabel("Жаңа құпиясөзді қайталаңыз").fill("new-secret-123");
    await page.getByRole("button", { name: "Құпиясөзді өзгерту" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Құпиясөз өзгертілді" })).toBeVisible();
    await page.reload(); // still signed in on this device
    await expect(page).toHaveURL(/\/kk\/account$/);

    await page.context().clearCookies();
    await loginAs(page, "e2e.pw", temp);
    await expect(formAlert(page)).toBeVisible();
    await loginAs(page, "e2e.pw", "new-secret-123");
    await expect(page).toHaveURL(/\/kk\/parent/);
  });
});
