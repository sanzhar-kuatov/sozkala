import { AuthError, authorize } from "@/lib/auth/guards";
import { ownInProgressAttempt } from "@/lib/student/attempts";
import { saveFile } from "@/lib/storage";

const MAX_BYTES = 10 * 1024 * 1024; // ~10 min of compressed speech; recordings are limited to 3 min by default
const EXT_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** POST multipart (file) → { file } — the student's recording for an AUDIO task. */
export async function POST(request: Request, { params }: RouteContext<"/api/attempts/[id]/audio">) {
  try {
    const user = await authorize(["STUDENT"], { write: true });
    const { id } = await params;
    const attempt = await ownInProgressAttempt(user, id);
    if (!attempt || attempt.task.type !== "AUDIO") return Response.json({ error: "notFound" }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "noFile" }, { status: 400 });
    if (file.size === 0 || file.size > MAX_BYTES) return Response.json({ error: "size" }, { status: 413 });
    const mime = file.type.split(";")[0].trim();
    const ext = EXT_BY_MIME[mime];
    if (!ext) return Response.json({ error: "type" }, { status: 415 });

    const key = await saveFile("audio", attempt.id, ext, Buffer.from(await file.arrayBuffer()));
    return Response.json({ file: key });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.code }, { status: 401 });
    throw error;
  }
}
