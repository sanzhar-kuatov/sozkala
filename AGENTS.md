<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Сөзқала project notes

- Read `README.md` (stack, scripts, conventions) and the plan stages before changing code. The design source of truth is `design/tokens.css` plus `docs/design/*.md`.
- `cacheComponents` is **off** on purpose (per-user, DB-driven pages). Don't add `"use cache"` without discussing it first.
- i18n: `app/[locale]` is the root layout. The locale comes from `next/root-params`, with the proxy header as fallback (`i18n/request.ts`). Every UI string lives in `messages/kk.json` and `messages/ru.json`.
- Database: **SQLite** (the user chose it to avoid running a DB server). The file is `prisma/dev.db`, accessed through `@prisma/adapter-libsql`. Don't use `better-sqlite3`: npm here blocks native install scripts. SQLite has no scalar lists (`String[]`), so use `Json` or relations instead; enums are allowed but not enforced by the DB.
- Prisma 7: the client is generated to `generated/prisma`. Import it via `@/generated/prisma/client` and use the `db` singleton from `@/lib/db`.
- Before finishing a stage, run `npm run check` and `npm run build`.
- Auth is our own code (no Auth.js): `lib/auth/*`. Every new page must call `requireRole()`, and every Server Action must call `authorize()`, because layout guards alone are not enough. Any mutating action must pass `{ write: true }` so parents stay read-only. Scope student data with `viewableStudentIds()` / `assertCanViewStudent()`.
- Use `redirect` from `@/i18n/navigation` with `locale: await getLocale()`, and keep it outside try/catch.
- E2E tests: `tests/e2e/*.spec.ts` (Playwright, Chrome channel, DB `prisma/e2e.db`). Add a spec for each new user flow; `npm run test:e2e` builds first.
- City art: `components/city/engine/*.ts` are pure functions returning SVG strings. They're injected with `dangerouslySetInnerHTML`, so any user text must go through `esc()` / `ftext()`. `tests/city-engine.test.ts` keeps them identical to `design/iso/*.js`, so change both files or update the test on purpose.
- Student data views live in `lib/student/*` and take `(viewer, studentId)` so the parent and teacher cabinets can reuse them; they call `assertCanViewStudent` themselves.
- Tasks: `Task.answerKey` must never be selected in a query whose result reaches a Client Component; `getStudentTask()` omits it on purpose, and an e2e test checks the HTML. Grading is pure (`lib/grading/grade.ts`), and every attempt is closed through `finalizeAttempt()` (Stage 6 adds building progression there).
- Uploaded files live in `uploads/` and are only served through `/api/files/...` after a `canViewStudent` check.
- Teacher-side checks: `lib/teacher/access.ts` (`assertTeachesClass`, `assertOwnsTask`, `assertTeachesStudent`). Every teacher action calls one of them after `authorize(["TEACHER","ADMIN"], { write: true })`.
- E2E DB reads go through `sql()` in `tests/e2e/helpers.ts`, which retries `SQLITE_BUSY`. Specs run alphabetically against one database, so a spec that changes a shared account must restore it.
- SQLite runs in WAL mode with `busy_timeout = 5000` (set in `lib/db.ts`, skipped during `next build`). Keep write transactions short.
- Certificates: rules are pure (`lib/certificates/rules.ts`), and issuing goes through `issueIfEligible()` (called from `applyGradedAttempt` and the teacher threshold actions). PDFs are drawn with `pdf-lib` and the TTFs in `assets/fonts/` (read from `process.cwd()` at runtime, so keep that folder deployed). `/verify/[code]` must never show personal data. The demo seed leaves `alina` one required task short (the town hall), and `certificates.spec.ts` finishes it.
- Admin: reads go in `lib/admin/queries.ts` (`assertAdmin(viewer)`) and writes in `app/[locale]/admin/actions.ts`. Add a platform setting only if something enforces it (`lib/settings.ts`, and mirror the defaults in `prisma/seed/reference.ts`). Log caught server failures with `logError()` (`lib/errors.ts`) without personal data. E2E uses `BACKUP_DIR=backups-e2e`.
- Security (Stage 13): the CSP nonce is set in `proxy.ts`, so never add inline `<script>` without the nonce, and keep pages dynamic. Static security headers live in `next.config.ts`. Registration needs consent (`lib/privacy.ts` version, audit `auth.register`). Every user changes their own password at `/account`. Admin "delete account" is the right-to-erasure path (cascades plus audio files). `docs/security.md` is the checklist. `tests/e2e/acceptance.spec.ts` covers all 10 acceptance tests from spec §14.
- Layout: `#main .grid` defaults to `minmax(0,1fr)` columns (`app/globals.css`, base layer), so long titles cannot widen pages on phones.
- Vercel demo deployment: `DATABASE_URL` may be `libsql://` (Turso) with `DATABASE_AUTH_TOKEN`. `lib/storage.ts` switches to private Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set. Backups are disabled there. Turso migrations go through `npm run db:remote` (applies `prisma/migrations/*/migration.sql`), because Prisma Migrate cannot reach Turso. Guide: `docs/deploy-vercel.md`.
- Grades: `Task.grade` (5–11) must match the class grade for class assignments, or one of the student's class grades for personal ones. Student task reads all go through `assignedTaskIds()`, which filters by grade. Demo tasks are grade 7 (class 7«Ә»).
- Task bank: `content/task-bank/*.json` is generated from `docs/0[1-4]_*.docx` by `npm run tasks:build` and imported with `npm run tasks:import` (`--remote` targets Turso; the import is idempotent by title and validated with `parseTask`). On the live site, grammar V1 was entered by hand, so import with `--except grammar-v1`.
