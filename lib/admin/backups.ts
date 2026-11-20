import "server-only";
import { mkdir, readdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";

/**
 * Database backups (spec §2.4, §11). `VACUUM INTO` writes a consistent copy of
 * the SQLite database (WAL included) while the app keeps running.
 * Files live in BACKUP_DIR (default ./backups, git-ignored).
 *
 * Restoring is deliberately not a button: stop the app, replace prisma/dev.db
 * with the backup file, start the app (see README).
 */
const ROOT = path.resolve(/* turbopackIgnore: true */ process.env.BACKUP_DIR ?? "backups");
const NAME = /^sozqala-\d{8}-\d{6}(-\d{1,3})?\.db$/;

export const isBackupName = (name: string) => NAME.test(name);

export type BackupFile = { name: string; size: number; createdAt: Date };

export async function listBackups(): Promise<BackupFile[]> {
  let names: string[];
  try {
    names = await readdir(ROOT);
  } catch {
    return [];
  }
  const files = await Promise.all(
    names.filter(isBackupName).map(async (name) => {
      const s = await stat(path.join(ROOT, name));
      return { name, size: s.size, createdAt: s.mtime };
    }),
  );
  return files.sort((a, b) => b.name.localeCompare(a.name));
}

/** Backups are files next to a local SQLite database; a hosted one (Turso) keeps its own backups. */
export const backupsSupported = () => (process.env.DATABASE_URL ?? "").startsWith("file:") && !process.env.VERCEL;

export async function createBackup(now = new Date()): Promise<BackupFile> {
  if (!backupsSupported()) throw new Error("backups need a local SQLite database");
  await mkdir(ROOT, { recursive: true });
  const stamp = now.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15); // 20261120-153012
  const taken = new Set((await listBackups()).map((b) => b.name));
  let name = `sozqala-${stamp}.db`;
  for (let i = 2; taken.has(name); i++) name = `sozqala-${stamp}-${i}.db`; // same second: never overwrite
  const target = path.join(ROOT, name);
  await db.$executeRawUnsafe(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  const s = await stat(target);
  return { name, size: s.size, createdAt: s.mtime };
}

export async function readBackup(name: string) {
  if (!isBackupName(name)) return null;
  try {
    return await readFile(path.join(ROOT, name));
  } catch {
    return null;
  }
}

export async function deleteBackup(name: string) {
  if (!isBackupName(name)) return false;
  try {
    await unlink(path.join(ROOT, name));
    return true;
  } catch {
    return false;
  }
}
