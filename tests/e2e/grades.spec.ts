import { expect, test } from "@playwright/test";
import { loginAs, sql } from "./helpers";

/**
 * Tasks belong to one school year (5–11): a grade-N task can only be assigned to
 * grade-N classes and their students, and a student never sees another grade's task.
 * The demo class 7«Ә» is a 7th-grade class.
 */
test.describe.serial("tasks by grade", () => {
  const TITLE = "6-сынып: синоним";
  let taskId = "";

  test("a 6th-grade task can't be assigned to a 7th-grade class", async ({ page }) => {
    await loginAs(page, "teacher");
    await expect(page).toHaveURL(/\/kk\/teacher$/);
    await page.goto("/kk/teacher/tasks/new");
    // the new task defaults to the teacher's class grade
    await expect(page.getByLabel("Қай сыныпқа арналған")).toHaveValue("7");
    await page.getByLabel("Атауы", { exact: true }).fill(TITLE);
    await page.getByLabel("Нұсқаулық (оқушыға)").fill("Выберите один ответ.");
    await page.getByLabel("Қай сыныпқа арналған").selectOption("6");
    await page.getByLabel("Сұрақ мәтіні").fill("Синоним к слову «смелый»?");
    await page.getByLabel("1-нұсқа", { exact: true }).fill("храбрый");
    await page.getByLabel("2-нұсқа", { exact: true }).fill("робкий");
    await page.getByRole("button", { name: "Сақтап, жариялау" }).click();
    await expect(page).toHaveURL(/\/kk\/teacher\/tasks\/[a-z0-9]{20,}$/);
    taskId = page.url().split("/").pop()!;

    // the teacher has no 6th-grade class → nothing to assign to, and 7«Ә» isn't offered
    await expect(page.getByText("Сізде 6-сынып жоқ")).toBeVisible();
    await expect(page.getByLabel("Кімге").locator("option", { hasText: "7«Ә»" })).toHaveCount(0);

    // the task bank shows the grade and filters by it
    await page.goto("/kk/teacher/tasks?grade=6");
    await expect(page.getByRole("link", { name: new RegExp(TITLE) })).toBeVisible();
    await expect(page.getByText("ПРЕ- или ПРИ-?")).toHaveCount(0);
    await page.goto("/kk/teacher/tasks?grade=7");
    await expect(page.getByText(TITLE)).toHaveCount(0);
  });

  test("an assigned task can't be moved to another grade", async ({ page }) => {
    await loginAs(page, "teacher");
    await expect(page).toHaveURL(/\/kk\/teacher$/);
    const [{ id }] = await sql("SELECT id FROM Task WHERE title = 'Фразеологизмы'");
    await page.goto(`/kk/teacher/tasks/${id}`);
    await page.getByLabel("Қай сыныпқа арналған").selectOption("6");
    await page.getByRole("button", { name: "Жоба ретінде сақтау" }).click();
    await expect(page.getByText("басқа сыныптың оқушыларына тағайындалған")).toBeVisible();
    expect((await sql("SELECT grade FROM Task WHERE id = ?", [String(id)]))[0].grade).toBe(7);
  });

  test("even a wrong assignment never reaches a student of another grade", async ({ page }) => {
    // simulate a bad row (e.g. from an old import): the 6th-grade task assigned to 7«Ә»
    await sql(
      "INSERT INTO TaskAssignment (id, taskId, classId, assignedById, isRequired, createdAt) SELECT 'e2e-wrong-grade', ?, 'demo-class-7a', id, 1, CURRENT_TIMESTAMP FROM User WHERE login = 'teacher'",
      [taskId],
    );
    try {
      await loginAs(page, "aruzhan");
      await expect(page).toHaveURL(/\/kk\/student$/);
      await page.goto("/kk/student/building/grammar");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(TITLE)).toHaveCount(0);
      const res = await page.goto(`/kk/student/task/${taskId}`);
      expect(res?.status()).toBe(404);
    } finally {
      await sql("DELETE FROM TaskAssignment WHERE id = 'e2e-wrong-grade'");
    }
  });

  test("the server refuses a cross-grade assignment even if the form is forged", async ({ page }) => {
    await loginAs(page, "teacher");
    await expect(page).toHaveURL(/\/kk\/teacher$/);
    await page.goto(`/kk/teacher/tasks/${taskId}`);
    // add the 7th-grade class to the dropdown by hand, as a forged request would
    await page
      .getByLabel("Кімге")
      .evaluate((el) => el.insertAdjacentHTML("beforeend", '<option value="class:demo-class-7a">7«Ә»</option>'));
    await page.getByLabel("Кімге").selectOption("class:demo-class-7a");
    await page.getByRole("button", { name: "Тағайындау", exact: true }).click();
    await expect(page.locator("form p.text-coral-700")).toContainText("сәйкес келмейді");
    expect(await sql("SELECT id FROM TaskAssignment WHERE taskId = ?", [taskId])).toHaveLength(0);
  });
});
