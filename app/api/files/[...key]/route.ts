import { AuthError, authorize, canViewStudent } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { assignedTaskIds } from "@/lib/student/city";
import { isSafeKey, MIME_BY_EXT, readStoredFile } from "@/lib/storage";

/**
 * GET /api/files/<folder>/<id>-<rand>.<ext> — streams a stored file after a permission check.
 *  audio/     students' recorded answers: the student, their teacher, a linked parent or an admin.
 *  materials/ task materials: the author, an admin, assigned students, their teachers and parents.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/files/[...key]">) {
  try {
    const user = await authorize();
    const key = (await params).key.join("/");
    if (!isSafeKey(key)) return new Response(null, { status: 404 });
    const [folder, name] = key.split("/");
    const ownerId = name.split("-")[0];

    let allowed = false;
    let mime: string | undefined;
    if (folder === "audio") {
      const attempt = await db.attempt.findUnique({ where: { id: ownerId }, select: { studentId: true } });
      allowed = !!attempt && (await canViewStudent(user, attempt.studentId));
    } else if (folder === "materials") {
      const material = await db.material.findFirst({
        where: { filePath: key },
        select: { taskId: true, mimeType: true },
      });
      allowed = !!material?.taskId && (await canSeeTask(user, material.taskId));
      mime = material?.mimeType ?? undefined;
    }
    if (!allowed) return new Response(null, { status: 404 });

    const file = await readStoredFile(key);
    if (!file) return new Response(null, { status: 404 });
    const ext = key.split(".").pop() ?? "";
    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": mime ?? MIME_BY_EXT[ext] ?? "application/octet-stream",
        "Content-Length": String(file.size),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return new Response(null, { status: 401 });
    throw error;
  }
}

async function canSeeTask(user: SessionUser, taskId: string) {
  if (user.role === "ADMIN") return true;
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: {
      authorId: true,
      assignments: { select: { classId: true, studentId: true, class: { select: { teacherId: true } } } },
    },
  });
  if (!task) return false;
  if (task.authorId === user.id) return true;
  if (user.role === "STUDENT") return (await assignedTaskIds(user.id)).assignments.some((a) => a.taskId === taskId);
  if (user.role === "TEACHER") return task.assignments.some((a) => a.class?.teacherId === user.id);
  // Parent: a linked child is assigned (directly or via a class).
  const children = await db.parentLink.findMany({ where: { parentId: user.id }, select: { studentId: true } });
  for (const { studentId } of children) {
    if ((await assignedTaskIds(studentId)).assignments.some((a) => a.taskId === taskId)) return true;
  }
  return false;
}
