import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";

/**
 * File storage for audio answers and task materials. Files are never served
 * statically: every read goes through an API route that checks permissions first.
 *
 * Two backends behind the same functions:
 *  - Vercel Blob (PRIVATE store) when BLOB_READ_WRITE_TOKEN is set — Vercel's disk
 *    is not persistent, so deployments there must use it;
 *  - local folder ./uploads (UPLOAD_DIR) otherwise — laptop / own server.
 * Keys look the same in both ("audio/<attemptId>-<random>.webm"), so the
 * database never stores a URL.
 */
// turbopackIgnore: uploads are user data at runtime, not part of the server bundle.
const ROOT = path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? "uploads");
const blobStorage = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/** Allowed folders and file names: letters, digits, dash, dot. Blocks "../" tricks. */
const SAFE = /^[a-z]+\/[A-Za-z0-9_-]+\.[a-z0-9]{2,5}$/;

export function isSafeKey(key: string) {
  return SAFE.test(key);
}

/** Saves bytes and returns the storage key, e.g. "audio/<attemptId>-<random>.webm". */
export async function saveFile(folder: "audio" | "materials", prefix: string, ext: string, data: Buffer) {
  const key = `${folder}/${prefix.replace(/[^A-Za-z0-9_-]/g, "")}-${randomBytes(6).toString("hex")}.${ext}`;
  if (!isSafeKey(key)) throw new Error("unsafe storage key");
  if (blobStorage()) {
    await put(key, data, {
      access: "private",
      addRandomSuffix: false,
      contentType: MIME_BY_EXT[ext] ?? "application/octet-stream",
    });
    return key;
  }
  await mkdir(path.join(/* turbopackIgnore: true */ ROOT, folder), { recursive: true });
  await writeFile(path.join(/* turbopackIgnore: true */ ROOT, key), data);
  return key;
}

export async function readStoredFile(key: string) {
  if (!isSafeKey(key)) return null;
  if (blobStorage()) {
    try {
      const result = await get(key, { access: "private" });
      if (!result) return null;
      const data = Buffer.from(await new Response(result.stream).arrayBuffer());
      return { data, size: data.length };
    } catch {
      return null;
    }
  }
  const file = path.join(/* turbopackIgnore: true */ ROOT, key);
  if (!file.startsWith(ROOT + path.sep)) return null;
  try {
    const [data, info] = await Promise.all([readFile(file), stat(file)]);
    return { data, size: info.size };
  } catch {
    return null;
  }
}

/** Removes the audio recordings of these attempts (files are named "<attemptId>-<random>.<ext>"). */
export async function deleteAudioFiles(attemptIds: string[]) {
  if (attemptIds.length === 0) return 0;
  const ids = new Set(attemptIds);
  const owner = (name: string) => ids.has(name.split("-")[0]);

  if (blobStorage()) {
    const doomed: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: "audio/", cursor, limit: 1000 });
      for (const b of page.blobs) if (owner(b.pathname.slice("audio/".length))) doomed.push(b.pathname);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    if (doomed.length) await del(doomed);
    return doomed.length;
  }

  const dir = path.join(/* turbopackIgnore: true */ ROOT, "audio");
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return 0;
  }
  const doomed = names.filter(owner);
  await Promise.all(doomed.map((n) => unlink(path.join(dir, n)).catch(() => {})));
  return doomed.length;
}

export const MIME_BY_EXT: Record<string, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  mp4: "audio/mp4",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};
