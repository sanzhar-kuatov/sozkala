-- AlterTable: every task belongs to one school year (5–11)
ALTER TABLE "Task" ADD COLUMN "grade" INTEGER NOT NULL DEFAULT 5;

-- Existing tasks take the grade of a class they are assigned to,
-- else of the class of a student they are assigned to personally, else 5.
UPDATE "Task" SET "grade" = COALESCE(
  (SELECT MIN(c."grade") FROM "TaskAssignment" a JOIN "SchoolClass" c ON c."id" = a."classId" WHERE a."taskId" = "Task"."id"),
  (SELECT MIN(c."grade") FROM "TaskAssignment" a JOIN "ClassMember" m ON m."studentId" = a."studentId" JOIN "SchoolClass" c ON c."id" = m."classId" WHERE a."taskId" = "Task"."id"),
  5
);

-- CreateIndex
CREATE INDEX "Task_grade_idx" ON "Task"("grade");
