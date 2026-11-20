// Prepares a hosted Turso (libSQL) database for the Vercel deployment.
//
//   node scripts/remote-db.mjs          apply new migrations (prisma/migrations/*/migration.sql)
//   node scripts/remote-db.mjs --seed   …and load reference data + the demo school (resets the demo data)
//
// Reads DATABASE_URL (libsql://…) and DATABASE_AUTH_TOKEN from the environment or from .env.turso.
// Prisma Migrate cannot connect to Turso, so the SQL files Prisma generated are applied here,
// in order, and remembered in the table _applied_migrations.
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import dotenv from "dotenv";

if (existsSync(".env.turso")) dotenv.config({ path: ".env.turso", override: true });
const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;
if (!url?.startsWith("libsql://") || !authToken) {
  console.error(
    "Set DATABASE_URL=libsql://… and DATABASE_AUTH_TOKEN (in .env.turso or the environment). See docs/deploy-vercel.md.",
  );
  process.exit(1);
}

const db = createClient({ url, authToken });
await db.execute(
  "CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
);
const done = new Set((await db.execute("SELECT name FROM _applied_migrations")).rows.map((r) => String(r.name)));

const dir = "prisma/migrations";
const names = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
let applied = 0;
for (const name of names) {
  if (done.has(name)) continue;
  const sql = readFileSync(path.join(dir, name, "migration.sql"), "utf8");
  process.stdout.write(`applying ${name} … `);
  await db.executeMultiple(sql);
  await db.execute({ sql: "INSERT INTO _applied_migrations (name) VALUES (?)", args: [name] });
  console.log("ok");
  applied++;
}
console.log(applied ? `${applied} migration(s) applied.` : "Database schema is up to date.");
db.close();

if (process.argv.includes("--seed")) {
  console.log("Seeding (reference data + demo school) — this takes a minute over the network …");
  execSync("npx prisma db seed", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DATABASE_AUTH_TOKEN: authToken },
  });
}
