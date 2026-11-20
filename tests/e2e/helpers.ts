import { createClient } from "@libsql/client";
import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "demo12345";

/** Direct access to the e2e database (to simulate admin actions in tests). */
export const e2eDb = () => createClient({ url: "file:./prisma/e2e.db" });

export async function loginAs(page: Page, login: string, password = DEMO_PASSWORD, path = "/kk/login") {
  await page.goto(path);
  await page.locator("#login").fill(login);
  await page.locator("#password").fill(password);
  await page.locator('form button[type="submit"]').first().click();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: /Шығу|Выйти/ }).click();
  await expect(page).toHaveURL(/\/kk\/login$/);
}

/** The form's error message (Next.js also renders an empty role="alert" route announcer). */
export const formAlert = (page: Page) => page.locator('form [role="alert"]');

/** Runs a query on the e2e database, retrying briefly if the app server holds the write lock. */
export async function sql(query: string, args: (string | number)[] = []) {
  for (let attempt = 0; ; attempt++) {
    const db = e2eDb();
    try {
      return (await db.execute({ sql: query, args })).rows;
    } catch (e) {
      if (attempt >= 10 || !String(e).includes("SQLITE_BUSY")) throw e;
      await new Promise((r) => setTimeout(r, 200));
    } finally {
      db.close();
    }
  }
}
