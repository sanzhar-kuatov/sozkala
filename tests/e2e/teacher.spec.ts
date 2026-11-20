import { expect, test, type Page } from "@playwright/test";
import { loginAs, logout, sql } from "./helpers";

async function asTeacher(page: Page) {
  await loginAs(page, "teacher");
  await expect(page).toHaveURL(/\/kk\/teacher$/);
}

/** Creates a single-choice task through the editor and returns its URL. */
async function createSingleChoiceTask(page: Page, title: string, building: string) {
  await page.goto("/kk/teacher/tasks/new");
  await page.getByLabel("Атауы", { exact: true }).fill(title);
  await page.getByLabel("Нұсқаулық (оқушыға)").fill("Выберите один ответ.");
  await page.getByLabel("Ғимарат").selectOption(building);
  await page.getByLabel("Сұрақ мәтіні").fill("Синоним к слову «смелый»?");
  await page.getByLabel("1-нұсқа", { exact: true }).fill("храбрый");
  await page.getByLabel("2-нұсқа", { exact: true }).fill("робкий");
  await page.getByLabel("3-нұсқа", { exact: true }).fill("хитрый");
  await page.getByRole("button", { name: "Сақтап, жариялау" }).click();
  await expect(page).toHaveURL(/\/kk\/teacher\/tasks\/[a-z0-9]{20,}$/);
  await expect(page.getByText("Жарияланған").first()).toBeVisible();
  return page.url();
}

test.describe("teacher cabinet (Stage 7)", () => {
  test("acceptance #1–#3: teacher creates a class and a task, the student builds from it", async ({ page }) => {
    await asTeacher(page);

    // class
    await page.goto("/kk/teacher/classes");
    await page.getByLabel("Атауы").fill("8«Б»");
    await page.getByLabel("Сынып", { exact: true }).selectOption("8");
    await page.getByRole("button", { name: "Сынып құру" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "8«Б»" })).toBeVisible();
    await expect(page.getByText(/^[A-Z2-9]{6}$/)).toBeVisible(); // invite code

    // student account (credentials shown once)
    await page.locator("#s-first").fill("Ерасыл");
    await page.locator("#s-last").fill("Тестов");
    await page.getByRole("button", { name: "Аккаунт ашу" }).click();
    const card = page.locator('[role="status"]', { hasText: "Ерасыл Тестов" });
    await expect(card).toBeVisible();
    const login = (await card.locator("dd").nth(0).textContent())!.trim();
    const password = (await card.locator("dd").nth(1).textContent())!.trim();
    expect(login).toBe("erasyl.t");

    // task → publish → assign to the class
    await createSingleChoiceTask(page, "Тест: синоним", "tower");
    await page.getByLabel("Кімге").selectOption({ label: "8«Б»" });
    await page.getByRole("button", { name: "Тағайындау", exact: true }).click();
    await expect(page.locator("li", { hasText: "8«Б»" }).getByText("Міндетті")).toBeVisible();

    // the student logs in, sees an empty city and the task, and builds the tower
    await logout(page);
    await loginAs(page, login, password);
    await expect(page).toHaveURL(/\/kk\/student$/);
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    await page.goto("/kk/student/building/tower");
    await page.locator("li", { hasText: "Тест: синоним" }).getByRole("link", { name: "Бастау" }).click();
    await page.getByRole("button", { name: "Бастау" }).click();
    await page.getByText("храбрый", { exact: true }).click();
    await page.getByRole("button", { name: "Тапсыру" }).click();
    await expect(page.getByRole("img", { name: "10/10" })).toBeVisible();
    await expect(page.getByText("Сөздер мұнарасы 5-деңгейге көтерілді")).toBeVisible();
  });

  test("the editor explains mistakes and its preview grades like the real player", async ({ page }) => {
    await asTeacher(page);
    await page.goto("/kk/teacher/tasks/new");
    await page.getByLabel("Атауы", { exact: true }).fill("ПРЕ/ПРИ");
    await page.getByLabel("Нұсқаулық (оқушыға)").fill("Вставьте букву.");
    await page.getByLabel("Түрі").selectOption("FILL_GAPS");
    await page.getByLabel("Сұрақ мәтіні").fill("Вставьте букву");
    await page.getByRole("button", { name: "Жоба ретінде сақтау" }).click();
    await expect(page.getByRole("status").filter({ hasText: "1-сұрақ" })).toContainText("бос орын жоқ");

    await page.getByLabel(/Мәтін \(жауаптарды/).fill("пр[е]красный, пр[и]ехать");
    await page.getByRole("button", { name: "Оқушы ретінде көру" }).click();
    await page.getByRole("textbox", { name: "1-бос орын" }).fill("е");
    await page.getByRole("textbox", { name: "2-бос орын" }).fill("и");
    await page.getByRole("button", { name: "Тексеру" }).click();
    await expect(page.getByText("10/10")).toBeVisible();
  });

  test("building settings reject unlock loops and the rule reaches students", async ({ page }) => {
    await asTeacher(page);
    await page.goto("/kk/teacher/buildings");
    await page.locator('select[name="after_grammar"]').selectOption("townhall");
    await page.getByRole("button", { name: "Сақтау" }).click();
    await expect(page.locator('form [role="alert"]')).toContainText("тұйық шеңбер");

    await page.locator('select[name="after_grammar"]').selectOption("");
    await page.locator('select[name="after_academy"]').selectOption("tower");
    await page.locator('select[name="min_academy"]').selectOption("3");
    await page.getByRole("button", { name: "Сақтау" }).click();
    await expect(page.getByText("Сақталды")).toBeVisible();

    await logout(page);
    await loginAs(page, "timur"); // Тимур's tower is still an empty lot
    await expect(page).toHaveURL(/\/kk\/student$/);
    await page.goto("/kk/student/building/academy");
    await expect(page.getByText("Бұл ғимарат әзірге жабық")).toBeVisible();
  });

  test("a task with submitted answers has its content locked", async ({ page }) => {
    await asTeacher(page);
    await page.goto("/kk/teacher/tasks?q=Н или НН");
    await page.getByRole("link", { name: /Н или НН\?/ }).click();
    await expect(page.getByText("сұрақтар мен жауаптар бекітілген")).toBeVisible();
    await expect(page.getByLabel("Түрі")).toBeDisabled();
  });

  test("granting an extra attempt, linking a parent and resetting a password", async ({ page }) => {
    await asTeacher(page);
    const [{ id: timurId }] = (await sql("SELECT id FROM User WHERE login = 'timur'")) as unknown as { id: string }[];

    // extra attempt
    await page.goto(`/kk/teacher/students/${timurId}`);
    await page.getByLabel("Тапсырма").first().selectOption({ label: "Фразеологизмы" });
    await page.getByRole("button", { name: "Рұқсат беру" }).click();
    await expect(page.getByText("Рұқсат берілді")).toBeVisible();
    expect(await sql("SELECT * FROM AttemptAllowance WHERE studentId = ?", [timurId])).toHaveLength(1);

    // parent account for Тимур
    await page.goto("/kk/teacher/classes/demo-class-7a");
    const row = page.locator("li", { hasText: "Жақсылықов Тимур" });
    await row.getByText(/Ата-аналар/).click();
    await row.getByLabel("Ата-ананың аты").fill("Гүлнар");
    await row.getByLabel("Ата-ананың тегі").fill("Жақсылықова");
    await row.getByRole("button", { name: "Қосу", exact: true }).click();
    const creds = row.locator('[role="status"]', { hasText: "Гүлнар Жақсылықова" });
    await expect(creds).toBeVisible();
    const parentLogin = (await creds.locator("dd").nth(0).textContent())!.trim();
    const parentPassword = (await creds.locator("dd").nth(1).textContent())!.trim();

    // password reset for Тимур (old password stops working)
    page.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "Құпиясөзді жаңарту" }).click();
    const reset = row.locator('[role="status"]', { hasText: "Тимур Жақсылықов" });
    await expect(reset).toBeVisible();
    const newPassword = (await reset.locator("dd").nth(1).textContent())!.trim();

    await logout(page);
    await loginAs(page, parentLogin, parentPassword);
    await expect(page).toHaveURL(/\/kk\/parent(\/child\/[a-z0-9]+)?$/);
    await logout(page);
    await loginAs(page, "timur", "demo12345");
    await expect(page.locator('form [role="alert"]')).toBeVisible();
    await loginAs(page, "timur", newPassword);
    await expect(page).toHaveURL(/\/kk\/student$/);
  });

  test("materials are visible to assigned students only", async ({ page, browser }) => {
    await asTeacher(page);
    const taskUrl = await createSingleChoiceTask(page, "С картинкой", "library");
    // 1×1 PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    await page.getByLabel("Файл атауы").fill("Схема");
    await page
      .getByLabel("Файл", { exact: true })
      .setInputFiles({ name: "scheme.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "Файл жүктеу" }).click();
    await expect(page.locator("li", { hasText: "Схема" })).toBeVisible();
    await page.getByLabel("Кімге").selectOption({ label: "Қасымова Аружан (7«Ә»)" });
    await page.getByRole("button", { name: "Тағайындау", exact: true }).click();

    const [{ filePath }] = (await sql("SELECT filePath FROM Material WHERE title = 'Схема'")) as unknown as {
      filePath: string;
    }[];
    expect(taskUrl).toContain("/teacher/tasks/");

    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await loginAs(other, "aruzhan");
    await expect(other).toHaveURL(/\/kk\/student$/);
    expect((await other.request.get(`/api/files/${filePath}`)).status()).toBe(200);
    await logout(other);
    await loginAs(other, "alina"); // not assigned
    await expect(other).toHaveURL(/\/kk\/student$/);
    expect((await other.request.get(`/api/files/${filePath}`)).status()).toBe(404);
    await ctx.close();
  });
});
