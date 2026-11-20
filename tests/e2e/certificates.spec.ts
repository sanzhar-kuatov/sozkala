import { expect, test } from "@playwright/test";
import { formAlert, loginAs, sql } from "./helpers";

/**
 * Stage 11 — acceptance #9 (the certificate is issued once the required tasks are
 * done) and #10 (the PDF downloads and its QR leads to a verify page). The seed
 * leaves Алина one required task short: the town hall's final work.
 */
test.describe.serial("certificates (Stage 11)", () => {
  let certificateId = "";
  let verifyPath = "";

  test("acceptance #9: finishing the last required task issues the certificate", async ({ page }) => {
    await loginAs(page, "alina");
    await expect(page).toHaveURL(/\/kk\/student$/);

    await page.goto("/kk/student/certificate");
    await expect(page.getByText("Сертификат әлі берілмеген")).toBeVisible();
    await expect(page.getByText("Міндетті тапсырмалар: 9/10")).toBeVisible();
    await expect(page.getByText("Итоговая работа: исправьте ошибки")).toBeVisible(); // listed as missing

    // the final work: one wrong word per sentence
    await page.goto("/kk/student/building/townhall");
    await page.locator("li", { hasText: "Итоговая работа" }).getByRole("link", { name: "Бастау" }).click();
    await page.getByRole("button", { name: "Бастау" }).click();
    for (const [wrong, right] of [
      ["видили", "видели"],
      ["правилла.", "правила."],
      ["калитке.", "калитки."],
    ]) {
      await page.getByRole("button", { name: `«${wrong}» сөзін түзету` }).click();
      const input = page.getByRole("textbox", { name: `«${wrong}» сөзін түзету` });
      await input.fill(right);
      await input.press("Enter");
      await page.getByRole("button", { name: /Келесі|Тапсыру/ }).click();
    }
    await expect(page).toHaveURL(/\/result\//, { timeout: 15_000 });
    await expect(page.getByRole("img", { name: /^10\/10$/ })).toBeVisible();

    await page.goto("/kk/student/certificate");
    const card = page.getByTestId("certificate-card");
    await expect(card).toBeVisible();
    // (9.5 + 7.5 + 7 + 8 + 9 + 8 + 8.5 + 10) / 8 = 8.4 → silver
    await expect(card.getByRole("heading", { name: "Күміс · 8.4/10" })).toBeVisible();
    await expect(card).toContainText(/SZ-\d{4}-\d{6}/);

    const rows = await sql(
      "SELECT c.id, c.verifyCode, c.tier FROM Certificate c JOIN User u ON u.id = c.studentId WHERE u.login = 'alina' AND c.revokedAt IS NULL",
    );
    expect(rows).toHaveLength(1);
    certificateId = String(rows[0].id);
    verifyPath = `/kk/verify/${rows[0].verifyCode}`;
    expect(rows[0].tier).toBe("SILVER");

    // the student is told (spec §8)
    await page.goto("/kk/student/notifications");
    await expect(page.getByText("Құттықтаймыз! Сен сертификат алдың!")).toBeVisible();
  });

  test("acceptance #10: the PDF downloads for the student and the QR page shows no personal data", async ({ page }) => {
    await loginAs(page, "alina");
    await expect(page).toHaveURL(/\/kk\/student$/);
    await page.goto("/kk/student/certificate");

    for (const lang of ["kk", "ru"]) {
      const link = page.getByRole("link", { name: lang === "kk" ? "PDF (қазақша)" : "PDF (орысша)" });
      await expect(link).toHaveAttribute("href", `/api/certificates/${certificateId}/pdf?lang=${lang}`);
      const res = await page.request.get(`/api/certificates/${certificateId}/pdf?lang=${lang}`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toBe("application/pdf");
      const body = await res.body();
      expect(body.subarray(0, 5).toString()).toBe("%PDF-");
      expect(body.length).toBeGreaterThan(10_000);
    }

    // the verify page works without logging in
    await page.context().clearCookies();
    await page.goto(verifyPath);
    await expect(page.getByText("Сертификат жарамды")).toBeVisible();
    await expect(page.getByText("Күміс").first()).toBeVisible();
    const text = await page.locator("main").innerText();
    expect(text).toMatch(/SZ-\d{4}-\d{6}/);
    for (const personal of ["Алина", "Ким", "7«Ә»", "Демо мектеп"]) expect(text).not.toContain(personal);
  });

  test("a wrong code is reported, and strangers cannot download the PDF", async ({ page }) => {
    await page.goto("/kk/verify/not-a-real-code-123");
    await expect(page.getByText("Сертификат табылмады")).toBeVisible();

    expect((await page.request.get(`/api/certificates/${certificateId}/pdf`)).status()).toBe(404); // anonymous
    for (const login of ["damir", "parent2"]) {
      await loginAs(page, login);
      await expect(page).not.toHaveURL(/\/login/);
      expect((await page.request.get(`/api/certificates/${certificateId}/pdf`)).status()).toBe(404);
      await page.context().clearCookies();
    }
  });

  test("the teacher sees the certificate and sets the class thresholds", async ({ page }) => {
    await loginAs(page, "teacher");
    await expect(page).toHaveURL(/\/kk\/teacher/);
    await page.goto("/kk/teacher/certificates");
    await expect(page.locator("tr", { hasText: "Ким Алина" })).toContainText("Күміс");
    await expect(page.getByText("Платформаның әдепкі шектері қолданылады.")).toBeVisible();

    // thresholds must rise
    await page.getByRole("spinbutton", { name: "Күміс" }).fill("5");
    await page.getByRole("button", { name: "Сақтау" }).click();
    await expect(formAlert(page)).toContainText("Шектер өсуі керек");

    // a lower gold threshold re-issues Алина's certificate as gold; the silver one becomes "replaced"
    await page.getByRole("spinbutton", { name: "Күміс" }).fill("7.5");
    await page.getByRole("spinbutton", { name: "Алтын" }).fill("8.4");
    await page.getByRole("button", { name: "Сақтау" }).click();
    await expect(page.getByRole("status").filter({ hasText: "сертификат берілді" })).toContainText("1 сертификат");
    await expect(page.locator("tr", { hasText: "Ким Алина" })).toContainText("Алтын");
    await expect(page.getByText("Бұл сыныптың өз шектері қолданылады.")).toBeVisible();

    await page.goto(verifyPath);
    await expect(page.getByText("Ауыстырылған сертификат")).toBeVisible();

    // back to the defaults (shared class — leave it as the seed had it)
    await page.goto("/kk/teacher/certificates");
    await page.getByRole("button", { name: "Әдепкі шектерге қайтару" }).click();
    await expect(page.getByText("Платформаның әдепкі шектері қолданылады.")).toBeVisible();
  });

  test("an admin revokes a certificate (verify says so) and reinstates it", async ({ page }) => {
    await loginAs(page, "admin", "admin12345");
    await expect(page).toHaveURL(/\/kk\/admin$/);
    await page.goto("/kk/admin/certificates?q=Алина");
    const active = page.locator("li", { hasText: "Ким Алина" }).filter({ hasNot: page.getByText("Ауыстырылған") });
    page.once("dialog", (d) => d.accept());
    await active.getByRole("button", { name: "Жою" }).click();
    await expect(active.getByText("Жойылған")).toBeVisible();

    const rows = await sql(
      "SELECT c.verifyCode FROM Certificate c JOIN User u ON u.id = c.studentId WHERE u.login = 'alina' AND c.revokedReason = 'REVOKED'",
    );
    const revokedPath = `/kk/verify/${rows[0].verifyCode}`;
    await page.goto(revokedPath);
    await expect(page.getByText("Сертификат жойылған")).toBeVisible();

    await page.goto("/kk/admin/certificates?q=Алина");
    await page.getByRole("button", { name: "Қалпына келтіру" }).click();
    await page.goto(revokedPath);
    await expect(page.getByText("Сертификат жарамды")).toBeVisible();
  });
});
