import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests (spec §14 acceptance scenarios grow here stage by stage).
 * Run with `npm run test:e2e`: builds the app, creates a fresh e2e database
 * (prisma/e2e.db — your dev data is never touched) and starts the server on :3500.
 * Uses the locally installed Google Chrome, so no browser download is needed.
 */
const PORT = 3500;
export const E2E_DATABASE_URL = "file:./prisma/e2e.db";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false, // tests share one SQLite file
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    locale: "kk-KZ",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node scripts/e2e-db.mjs && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: E2E_DATABASE_URL, UPLOAD_DIR: "uploads-e2e", BACKUP_DIR: "backups-e2e" },
  },
});
