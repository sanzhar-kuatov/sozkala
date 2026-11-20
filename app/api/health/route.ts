import { db } from "@/lib/db";

/** Liveness + database check: GET /api/health → { ok, db } (503 when the DB is unreachable). */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: "up" });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
