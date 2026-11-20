import { expect, test } from "@playwright/test";
import { loginAs, sql } from "./helpers";

const count = async (query: string, args: string[]) =>
  Number(((await sql(query, args))[0] as unknown as { n: number }).n);

test.describe("analytics (Stage 10)", () => {
  test("the teacher sees class summary, topic results, charts with a table view and the students table", async ({
    page,
  }) => {
    await loginAs(page, "teacher");
    await expect(page).toHaveURL(/\/kk\/teacher/);
    await page.goto("/kk/teacher/analytics");

    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toContainText("Аналитика · ");
    const className = (await h1.textContent())!.split(" · ")[1].trim();

    for (const tile of ["Тапсырмалар", "Орташа балл", "Әрекеттер", "Салынған ғимараттар", "Орындалуы"]) {
      await expect(page.locator("main ul").first().getByText(tile, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Тексеруді күтуде" })).toHaveAttribute("href", "/kk/teacher/review");

    // results by topic: at least one bar, and the table view lists the same rows
    const topics = page.getByRole("list", { name: "Тақырыптар бойынша нәтиже" }).locator("li");
    expect(await topics.count()).toBeGreaterThan(0);
    const firstTable = page.locator("details").first();
    await firstTable.locator("summary").click();
    await expect(firstTable.locator("tbody tr")).toHaveCount(await topics.count());

    await expect(page.getByRole("img", { name: "Апта сайынғы орташа балл" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Апта сайынғы әрекеттер" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Ғимараттар бойынша деңгей" }).locator("li")).toHaveCount(8);

    // one row per class member, each linking to the student page
    const members = await count(
      "SELECT COUNT(*) AS n FROM ClassMember m JOIN SchoolClass c ON c.id = m.classId WHERE c.name = ?",
      [className],
    );
    const studentsCard = page.locator("table", {
      has: page.getByRole("columnheader", { name: "Оқушы", exact: true }),
    });
    await expect(studentsCard.locator("tbody tr")).toHaveCount(members);
    await studentsCard.locator("tbody tr a").first().click();
    await expect(page).toHaveURL(/\/kk\/teacher\/students\/[a-z0-9]+$/);
  });

  test("the student's history shows the progress line and every submitted attempt", async ({ page }) => {
    await loginAs(page, "aruzhan");
    await expect(page).toHaveURL(/\/kk\/student/);
    await page.goto("/kk/student/history");
    await expect(page.getByRole("heading", { level: 1, name: "Менің прогресім" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Балдар динамикасы" })).toBeVisible();

    const submitted = await count(
      "SELECT COUNT(*) AS n FROM Attempt a JOIN User u ON u.id = a.studentId WHERE u.login = ? AND a.status != 'IN_PROGRESS'",
      ["aruzhan"],
    );
    const timeline = page.locator("main ol > li");
    await expect(timeline).toHaveCount(submitted);
    await timeline.first().getByRole("link").click();
    await expect(page).toHaveURL(/\/kk\/student\/task\/[a-z0-9]+\/result\/[a-z0-9]+$/);
  });

  test("the parent sees the child's progress line but not the teacher analytics", async ({ page }) => {
    await loginAs(page, "parent");
    await expect(page).toHaveURL(/\/kk\/parent\/child\//);
    await expect(page.getByRole("img", { name: "Балдар динамикасы" })).toBeVisible();
    await page.goto("/kk/teacher/analytics");
    await expect(page).toHaveURL(/\/kk\/parent/);
  });
});
