import { AuthError, authorize } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { saveFile } from "@/lib/storage";
import { assertOwnsTask } from "@/lib/teacher/access";

const MAX_BYTES = 25 * 1024 * 1024;
const KIND_BY_MIME: Record<string, { kind: "IMAGE" | "AUDIO" | "VIDEO"; ext: string }> = {
  "image/png": { kind: "IMAGE", ext: "png" },
  "image/jpeg": { kind: "IMAGE", ext: "jpg" },
  "image/webp": { kind: "IMAGE", ext: "webp" },
  "image/gif": { kind: "IMAGE", ext: "gif" },
  "audio/mpeg": { kind: "AUDIO", ext: "mp3" },
  "audio/mp4": { kind: "AUDIO", ext: "m4a" },
  "audio/ogg": { kind: "AUDIO", ext: "ogg" },
  "audio/wav": { kind: "AUDIO", ext: "wav" },
  "audio/webm": { kind: "AUDIO", ext: "webm" },
  "video/mp4": { kind: "VIDEO", ext: "mp4" },
  "video/webm": { kind: "VIDEO", ext: "webm" },
};

/** POST multipart (file, title) — teacher attaches an image / audio / video to a task (spec §2.2). */
export async function POST(request: Request, { params }: RouteContext<"/api/tasks/[id]/materials">) {
  try {
    const user = await authorize(["TEACHER", "ADMIN"], { write: true });
    const { id } = await params;
    await assertOwnsTask(user, id);

    const form = await request.formData();
    const file = form.get("file");
    const title = String(form.get("title") ?? "")
      .trim()
      .slice(0, 160);
    if (!(file instanceof File)) return Response.json({ error: "noFile" }, { status: 400 });
    if (file.size === 0 || file.size > MAX_BYTES) return Response.json({ error: "size" }, { status: 413 });
    const type = KIND_BY_MIME[file.type];
    if (!type) return Response.json({ error: "type" }, { status: 415 });

    const key = await saveFile("materials", id, type.ext, Buffer.from(await file.arrayBuffer()));
    const material = await db.material.create({
      data: {
        taskId: id,
        uploadedById: user.id,
        kind: type.kind,
        title: title || file.name.slice(0, 160),
        filePath: key,
        mimeType: file.type,
        sizeBytes: file.size,
      },
      select: { id: true },
    });
    await audit({
      actorId: user.id,
      action: "material.upload",
      entity: "Task",
      entityId: id,
      data: { kind: type.kind },
    });
    return Response.json({ id: material.id });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.code }, { status: 403 });
    throw error;
  }
}
