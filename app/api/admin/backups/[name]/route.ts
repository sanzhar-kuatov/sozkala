import { AuthError, authorize } from "@/lib/auth/guards";
import { readBackup } from "@/lib/admin/backups";
import { audit } from "@/lib/audit";

/** GET /api/admin/backups/<file> — admins only; the backup holds everyone's data. */
export async function GET(_request: Request, { params }: RouteContext<"/api/admin/backups/[name]">) {
  try {
    const user = await authorize(["ADMIN"]);
    const { name } = await params;
    const data = await readBackup(name);
    if (!data) return new Response(null, { status: 404 });
    await audit({ actorId: user.id, action: "backup.download", entity: "Backup", entityId: name });
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(data.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return new Response(null, { status: 404 });
    throw error;
  }
}
