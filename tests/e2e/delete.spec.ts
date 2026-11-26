import { expect, test } from "@playwright/test";
import { loginAs, sql } from "./helpers";

/** Archive is reversible; delete removes the row for good (after a confirm dialog). */
test.describe("archive vs delete (classes and tasks)", () => {
  test.beforeEach(async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await loginAs(page, "teacher");
    await expect(page).toHaveURL(/\/kk\/teacher$/);
  });

  test("a class can be archived, restored and deleted; its students keep their accounts", async ({ page }) => {
    await page.goto("/kk/teacher/classes");
    await page.getByLabel("Атауы").fill("9«Ж»");
    await page.getByLabel("Сынып", { exact: true }).selectOption("9");
    await page.getByRole("button", { name: "Сынып құру" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "9«Ж»" })).toBeVisible();
    const classId = page.url().split("/").pop()!;

    await page.locator("#s-first").fill("Жоюбек");
    await page.locator("#s-last").fill("Тестов");
    await page.getByRole("button", { name: "Аккаунт ашу" }).click();
    await expect(page.getByText("Жоюбек Тестов").first()).toBeVisible();
    const [student] = await sql("SELECT studentId FROM ClassMember WHERE classId = ?", [classId]);

    await page.getByRole("button", { name: "Мұрағатқа" }).click();
    await expect(page.getByRole("button", { name: "Мұрағаттан шығару" })).toBeVisible();
    await page.getByRole("button", { name: "Мұрағаттан шығару" }).click();
    await expect(page.getByRole("button", { name: "Мұрағатқа" })).toBeVisible();

    await page.getByRole("button", { name: "Сыныпты жою" }).click();
    await expect(page).toHaveURL(/\/kk\/teacher\/classes$/);
    expect(await sql("SELECT id FROM SchoolClass WHERE id = ?", [classId])).toHaveLength(0);
    // the student's account stays; clean it up so other specs see the usual data
    expect(await sql("SELECT id FROM User WHERE id = ?", [String(student.studentId)])).toHaveLength(1);
    await sql("DELETE FROM User WHERE id = ?", [String(student.studentId)]);
  });

  test("a task with answers can be archived, restored and deleted with its answers", async ({ page }) => {
    await page.goto("/kk/teacher/tasks/new");
    await page.getByLabel("Атауы", { exact: true }).fill("Жоюға арналған тапсырма");
    await page.getByLabel("Нұсқаулық (оқушыға)").fill("Выберите один ответ.");
    await page.getByLabel("Ғимарат").selectOption("grammar");
    await page.getByLabel("Сұрақ мәтіні").fill("Синоним к слову «смелый»?");
    await page.getByLabel("1-нұсқа", { exact: true }).fill("храбрый");
    await page.getByLabel("2-нұсқа", { exact: true }).fill("робкий");
    await page.getByLabel("3-нұсқа", { exact: true }).fill("хитрый");
    await page.getByRole("button", { name: "Сақтап, жариялау" }).click();
    await expect(page).toHaveURL(/\/kk\/teacher\/tasks\/[a-z0-9]{20,}$/);
    const taskId = page.url().split("/").pop()!;

    const [aruzhan] = await sql("SELECT id FROM User WHERE login = 'aruzhan'");
    await sql(
      "INSERT INTO Attempt (id, taskId, studentId, number, status, answers, score, startedAt) VALUES (?, ?, ?, 1, 'GRADED', '{}', 7, CURRENT_TIMESTAMP)",
      [`e2e-del-${taskId}`, taskId, String(aruzhan.id)],
    );
    await page.reload();

    await page.getByRole("button", { name: "Мұрағатқа" }).click();
    await expect(page.getByText("Мұрағатта").first()).toBeVisible();
    await page.getByRole("button", { name: "Мұрағаттан шығару" }).click();
    await expect(page.getByText("Жоба").first()).toBeVisible();

    await page.getByRole("button", { name: "Жою", exact: true }).click();
    await expect(page).toHaveURL(/\/kk\/teacher\/tasks$/);
    expect(await sql("SELECT id FROM Task WHERE id = ?", [taskId])).toHaveLength(0);
    expect(await sql("SELECT id FROM Attempt WHERE taskId = ?", [taskId])).toHaveLength(0);
  });
});
