import { expect, type Page, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { loginAs, logout, sql } from "./helpers";

/**
 * Spec §14 — the 10 acceptance tests, run as ONE journey along the student path
 * of spec §13, with a brand-new class, student and parent (nothing from the demo
 * accounts is changed). It reuses two demo tasks, which are 7th-grade tasks, so the class is a
 * 7th-grade class; its name sorts after 7«Ә», which stays first in teacher lists.
 */
const CLASS = "7«Ә»-2";
const PRE_PRI = "ПРЕ- или ПРИ-?";
const ESSAY = "Эссе «Мой любимый литературный герой»";

const level = async (login: string, building: string) =>
  Number(
    (
      await sql(
        `SELECT bp.level FROM BuildingProgress bp JOIN City c ON c.id = bp.cityId JOIN User u ON u.id = c.studentId
         JOIN BuildingType bt ON bt.id = bp.buildingTypeId WHERE u.login = ? AND bt.key = ?`,
        [login, building],
      )
    )[0].level,
  );

async function readCredentials(page: Page, name: string) {
  const card = page.locator('[role="status"]', { hasText: name });
  await expect(card).toBeVisible();
  return {
    login: (await card.locator("dd").nth(0).textContent())!.trim(),
    password: (await card.locator("dd").nth(1).textContent())!.trim(),
  };
}

async function assign(page: Page, title: string) {
  const [{ id }] = await sql("SELECT id FROM Task WHERE title = ?", [title]);
  await page.goto(`/kk/teacher/tasks/${id}`);
  await page.getByLabel("Кімге").selectOption({ label: CLASS });
  await page.getByRole("button", { name: "Тағайындау", exact: true }).click();
  await expect(page.locator("li", { hasText: CLASS }).getByText("Міндетті")).toBeVisible();
}

async function startTask(page: Page, building: string, title: string) {
  await page.goto(`/kk/student/building/${building}`);
  await page
    .locator("li", { hasText: title })
    .getByRole("link", { name: /Бастау|Қайта орындау/ })
    .click();
  await page.getByRole("button", { name: /Бастау|Қайта орындау/ }).click();
  await expect(page.getByRole("button", { name: /Келесі|Тапсыру/ })).toBeVisible();
}

/** ПРЕ/ПРИ: four gaps, one per question. */
async function fillPrePri(page: Page, letters: string[]) {
  for (const [i, letter] of letters.entries()) {
    await page.getByRole("textbox", { name: "1-бос орын" }).fill(letter);
    await page.getByRole("button", { name: i < letters.length - 1 ? "Келесі" : "Тапсыру" }).click();
  }
  await expect(page).toHaveURL(/\/result\//, { timeout: 15_000 });
}

test.describe.serial("acceptance tests (spec §14) along the student path (spec §13)", () => {
  let student = { login: "", password: "" };
  let parent = { login: "", password: "" };
  let studentId = "";

  test("#1 the teacher creates a class, a student and a parent, and assigns tasks", async ({ page }) => {
    await loginAs(page, "teacher");
    await expect(page).toHaveURL(/\/kk\/teacher$/);

    await page.goto("/kk/teacher/classes");
    await page.getByLabel("Атауы").fill(CLASS);
    await page.getByLabel("Сынып", { exact: true }).selectOption("7");
    await page.getByRole("button", { name: "Сынып құру" }).click();
    await expect(page.getByRole("heading", { level: 1, name: CLASS })).toBeVisible();
    const classUrl = page.url();
    const classId = classUrl.split("/").pop()!;

    await page.locator("#s-first").fill("Нұрлан");
    await page.locator("#s-last").fill("Сапаров");
    await page.getByRole("button", { name: "Аккаунт ашу" }).click();
    student = await readCredentials(page, "Нұрлан Сапаров");
    [{ id: studentId }] = (await sql("SELECT id FROM User WHERE login = ?", [student.login])) as unknown as {
      id: string;
    }[];

    const row = page.locator("li", { hasText: "Сапаров Нұрлан" });
    await row.getByText(/Ата-аналар/).click();
    await row.getByLabel("Ата-ананың аты").fill("Әсел");
    await row.getByLabel("Ата-ананың тегі").fill("Сапарова");
    await row.getByRole("button", { name: "Қосу", exact: true }).click();
    parent = await readCredentials(page, "Әсел Сапарова");

    // §3: in this class only the grammar palace and the academy are required
    await page.goto(`/kk/teacher/buildings?class=${classId}`);
    for (const key of ["bridge", "library", "theatre", "tower", "park", "townhall"]) {
      await page.locator(`input[name="required_${key}"]`).uncheck();
    }
    await page.getByRole("button", { name: "Сақтау" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Сақталды" })).toBeVisible();

    await assign(page, PRE_PRI);
    await assign(page, ESSAY);
  });

  test("#2 #3 the student sees an empty city, does the task, and the building appears (§13 steps 1–4)", async ({
    page,
  }) => {
    await loginAs(page, student.login, student.password);
    await expect(page).toHaveURL(/\/kk\/student$/);
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    await expect(page.locator(".iso-city .plot:not(.plot--square)")).toHaveCount(8);

    // 3 of 4 right → 7.5 points → the palace is built at level 3 (spec §13 step 4)
    await startTask(page, "grammar", PRE_PRI);
    await fillPrePri(page, ["е", "и", "е", "е"]);
    await expect(page.getByRole("img", { name: /^7\.5\/10$/ })).toBeVisible();
    expect(await level(student.login, "grammar")).toBe(3);
    await page.goto("/kk/student");
    await expect(page.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow", "0");
  });

  test("§13 step 5: the parent sees the change, the teacher sees the result", async ({ page }) => {
    await loginAs(page, parent.login, parent.password);
    await expect(page).toHaveURL(new RegExp(`/kk/parent/child/${studentId}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Нұрлан Сапаров" })).toBeVisible();
    await expect(page.getByText("Грамматика сарайы").first()).toBeVisible();
    await logout(page);

    await loginAs(page, "teacher");
    await expect(page).toHaveURL(/\/kk\/teacher$/);
    await page.goto(`/kk/teacher/students/${studentId}`);
    await expect(page.getByText(PRE_PRI).first()).toBeVisible();
  });

  test("#4 a better score changes the building; #5 progress survives logout and login (§13 step 6)", async ({
    page,
  }) => {
    await loginAs(page, student.login, student.password);
    await expect(page).toHaveURL(/\/kk\/student$/);
    await startTask(page, "grammar", PRE_PRI);
    await fillPrePri(page, ["е", "и", "е", "и"]);
    await expect(page.getByRole("img", { name: /^10\/10$/ })).toBeVisible();
    expect(await level(student.login, "grammar")).toBe(5);

    await logout(page);
    await loginAs(page, student.login, student.password);
    await expect(page).toHaveURL(/\/kk\/student$/);
    await page.locator('.plot[data-key="grammar"]').click();
    await expect(page.getByText("10/10").first()).toBeVisible();
    expect(await level(student.login, "grammar")).toBe(5);
  });

  test("#8 the teacher reviews the essay and the city updates (§13 step 7)", async ({ page }) => {
    await loginAs(page, student.login, student.password);
    await expect(page).toHaveURL(/\/kk\/student$/);
    await startTask(page, "academy", ESSAY);
    await page
      .getByRole("textbox")
      .fill("Мой любимый герой — Пётр Гринёв. Он честный, смелый и верный своему слову даже перед Пугачёвым.");
    await page.getByRole("button", { name: "Тапсыру" }).click();
    const confirm = page.getByRole("button", { name: "Иә, тапсыру" });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await expect(page.getByRole("heading", { name: "Мұғалімге жіберілді" })).toBeVisible();
    expect(await level(student.login, "academy")).toBe(0);
    await logout(page);

    await loginAs(page, "teacher");
    await expect(page).toHaveURL(/\/kk\/teacher$/);
    await page.goto("/kk/teacher/review");
    await page.locator("li", { hasText: "Нұрлан Сапаров" }).getByRole("link", { name: "Бағалау" }).click();
    await page.locator('label:has(input[name="c_content"][value="4"])').click();
    await page.locator('label:has(input[name="c_literacy"][value="3"])').click();
    await page.locator('label:has(input[name="c_structure"][value="3"])').click();
    await page.getByRole("button", { name: "Бағалау" }).click();
    await expect(page).toHaveURL(/\/kk\/teacher\/review$/);
    expect(await level(student.login, "academy")).toBe(5);
  });

  test("#9 with the required tasks done, the certificate is issued (§13 step 8)", async ({ page }) => {
    await loginAs(page, student.login, student.password);
    await expect(page).toHaveURL(/\/kk\/student$/);
    await page.goto("/kk/student/certificate");
    await expect(page.getByTestId("certificate-card")).toContainText("Платина · 10/10");
    await expect(page.getByText("Міндетті тапсырмалар: 2/2")).toBeVisible();
    await expect(page.getByText("Негізгі ғимараттар 3-деңгейге жетті: 2/2")).toBeVisible();
  });

  test("#10 the PDF downloads and its QR code leads to the verify page", async ({ page }) => {
    await loginAs(page, parent.login, parent.password); // a parent can download it too
    await expect(page).toHaveURL(/\/kk\/parent\/child\//);
    const href = await page.getByRole("link", { name: "PDF (қазақша)" }).getAttribute("href");
    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");

    // the QR target is stored in the PDF (Subject + link annotation over the QR)
    const pdf = await PDFDocument.load(await res.body());
    const target = new URL(pdf.getSubject()!);
    expect(target.pathname).toMatch(/^\/kk\/verify\/[A-Za-z0-9_-]{16}$/);

    await page.context().clearCookies(); // anyone who scans it, no login
    await page.goto(target.pathname);
    await expect(page.getByText("Сертификат жарамды")).toBeVisible();
    await expect(page.locator("main")).not.toContainText("Сапаров");
  });

  test("#6 the parent sees only their own child; #7 the parent cannot change grades", async ({ page }) => {
    await loginAs(page, parent.login, parent.password);
    await expect(page).toHaveURL(/\/kk\/parent\/child\//);
    const [{ id: aruzhan }] = await sql("SELECT id FROM User WHERE login = 'aruzhan'");
    expect((await page.goto(`/kk/parent/child/${aruzhan}`))?.status()).toBe(404);

    await page.goto(`/kk/parent/child/${studentId}`);
    await expect(page.locator("main form")).toHaveCount(0);
    for (const path of ["/kk/teacher/review", "/kk/student/task/x", "/kk/admin/users"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/kk\/parent/);
    }
  });
});
