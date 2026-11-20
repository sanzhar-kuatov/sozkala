// Creates a fresh e2e database (prisma/e2e.db): migrate + reference data + demo school.
// Runs before the e2e server starts (see playwright.config.ts), so the file is never locked.
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`prisma/e2e.db${suffix}`, { force: true });
rmSync("uploads-e2e", { recursive: true, force: true }); // files uploaded by previous e2e runs
rmSync("backups-e2e", { recursive: true, force: true });
const env = { ...process.env, DATABASE_URL: "file:./prisma/e2e.db" };
execSync("npx prisma migrate deploy", { env, stdio: "ignore" });
execSync("npx prisma db seed", { env, stdio: "ignore" });
console.log("e2e database ready");
