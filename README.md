# СӨЗҚАЛА / СЛОВОГРАД

Gamified web platform for **Russian language & literature, grades 5–11**. Each student builds a personal isometric city: 8 buildings map to 8 learning areas, and task scores (0–10) grow each building through 5 visual levels. Roles: student, teacher, parent (read-only), admin.

- Specification: `Sozqala_tehnikalyk_tapsyrma_kz.docx` (Kazakh)
- Design system & UX (Stage 0): [`design/preview.html`](design/preview.html) (open directly in a browser) and [`docs/design/`](docs/design/)

## Stack

| Layer      | Choice                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| App        | Next.js 16 (App Router, Turbopack), React 19, TypeScript strict                                                                                |
| Styling    | Tailwind CSS v4. Tokens come from [`design/tokens.css`](design/tokens.css) and are mapped in [`app/globals.css`](app/globals.css)              |
| i18n       | `next-intl`: UI in **Kazakh** (`/kk`, default) and **Russian** (`/ru`). Learning content is in Russian                                         |
| Data       | **SQLite**: one file, `prisma/dev.db`, with no server to install. Accessed via Prisma 7 (`prisma-client` generator + `@prisma/adapter-libsql`) |
| Validation | Zod                                                                                                                                            |
| Tests      | Vitest (unit). Playwright arrives in Stage 13                                                                                                  |

## Getting started

Requirements: **Node 22+**. Nothing else; the database is a single SQLite file (`prisma/dev.db`).

```bash
npm install            # also runs `prisma generate`
npm run setup          # creates .env (with a random AUTH_SECRET), the database tables, reference data and the demo school
npm run dev            # http://localhost:3000 → redirects to /kk
```

Check the database connection with `GET /api/health`. It returns `{"ok":true,"db":"up"}`, or HTTP 503 when the DB is unreachable.

> **Backup:** copy `prisma/dev.db` while the app is stopped. **Start over:** `npm run db:reset` deletes all data, then re-creates the tables and demo data.

### Demo accounts

Created by the seed. In `npm run dev`, the login page has one-click buttons for them.

| Login     | Password     | Role    | Notes                                                  |
| --------- | ------------ | ------- | ------------------------------------------------------ |
| `admin`   | `admin12345` | admin   | change via `SEED_ADMIN_PASSWORD` before the first seed |
| `teacher` | `demo12345`  | teacher | Гүлмира Ахметова, class 7«Ә» (invite code `SOZ7A1`)    |
| `aruzhan` | `demo12345`  | student | half-built city, an essay waiting for review           |
| `alina`   | `demo12345`  | student | best in class, 7 buildings at L3+                      |
| `damir`   | `demo12345`  | student | creative work waiting for review                       |
| `madina`  | `demo12345`  | student | just started                                           |
| `timur`   | `demo12345`  | student | empty city, the "first login" state                    |
| `parent`  | `demo12345`  | parent  | Аружан's mother (sees only Аружан)                     |
| `parent2` | `demo12345`  | parent  | Дамир's father (sees only Дамир)                       |

For a real installation without demo data, run `SEED_DEMO=false npm run setup`.

## Scripts

| Script                            | What it does                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server                          |
| `npm run lint`                    | ESLint (`eslint-config-next`)                                                      |
| `npm run typecheck`               | Generates route types, then runs `tsc --noEmit`                                    |
| `npm test`                        | Vitest unit tests (`**/*.test.ts`)                                                 |
| `npm run test:e2e`                | Browser tests (Playwright + your installed Chrome) against a fresh `prisma/e2e.db` |
| `npm run check`                   | lint + typecheck + test (run before every commit)                                  |
| `npm run format`                  | Prettier (with Tailwind class sorting)                                             |
| `npm run setup`                   | First run: create `.env`, apply migrations, generate the client, seed              |
| `npm run db:seed`                 | Re-seed: reference data (safe) + demo school (recreated)                           |
| `npm run db:reset`                | Wipe the database, re-apply migrations and seed (dev only)                         |
| `npm run db:migrate`              | After editing `prisma/schema.prisma`: create a migration and regenerate the client |
| `npm run db:generate`             | Regenerate the Prisma client only                                                  |
| `npm run db:studio`               | Prisma Studio, a browser UI for the database                                       |

The data model is described in [docs/data-model.md](docs/data-model.md).

## Project layout

```
app/
  [locale]/                 root layout (fonts, i18n provider), landing, login, 404
    student/ teacher/ parent/ admin/   one cabinet per role (AppShell layout + pages)
  api/health/               DB health check
  globals.css               Tailwind + design tokens
components/
  ui/                       Button, Card, Chip, Field/Input, Progress (design-system primitives)
  tasks/                    task player: one input per task type, audio recorder, materials
  teacher/                  task editor (all 12 types), question editors, preview, credentials card
  shell/                    AppShell, role navigation, locale switcher, placeholders
  brand/                    Logo
  city/                     isometric city: engine/ (pure SVG-string functions), CityMap (pan/zoom), CityExplorer
i18n/                       routing (kk|ru), request config, navigation helpers
messages/                   kk.json, ru.json (the same keys; a test enforces this)
lib/                        db, env, utils, storage · domain/ · tasks/ (content + answer schemas) · grading/ · student/ · auth/
prisma/                     schema.prisma, migrations/, seed.ts + seed/ (reference + demo data)
design/                     Stage 0 design system: tokens, iso engine, preview page
docs/design/                design system, isometric art spec, UX wireframes
proxy.ts                    locale routing (Next 16 "proxy" = former middleware)
```

## Authentication & roles

- **Login:** login + password (Argon2id hashes). Students can also self-register with a class invite code at `/join/CODE`. Teacher, parent and admin accounts are created by an admin or teacher (Stages 7 and 12).
- **Sessions:** a signed token (HS256, `AUTH_SECRET`) in an httpOnly cookie, plus a `Session` row in the database. Logging out, deactivating an account or deleting the row ends the session immediately. Sessions last 14 days.
- **Two layers of checks:**
  1. [`proxy.ts`](proxy.ts) does fast redirects using the cookie only: signed-out visitors go to `/login?next=…`, and the wrong role goes to its own cabinet.
  2. [`lib/auth/guards.ts`](lib/auth/guards.ts) is the real boundary. Pages call `requireRole()`, Server Actions call `authorize()`, and student data goes through `canViewStudent()`. Parents are read-only (`authorize(..., { write: true })` rejects them).
- **Brute-force protection:** 5 failed logins for an account lock it for 15 minutes.
- **Audit log:** logins, failed logins, logouts and registrations are recorded in `AuditLog` (spec §11).

## Conventions

- **Links and navigation:** import `Link`, `redirect`, `useRouter` and `usePathname` from `@/i18n/navigation`, not from `next/link`, so the locale prefix is kept.
- **Text:** never hard-code UI strings. Add the key to **both** `messages/kk.json` and `messages/ru.json`; `npm test` fails if the two files differ.
- **Colours and spacing:** use the token utilities (`bg-primary`, `text-muted`, `bg-sky-100`, `shadow-card`, `rounded-lg`, …). Tailwind's default palette is disabled on purpose.
- **Server-only code** (`lib/db.ts`, `lib/env.ts`) imports `server-only`.
- **Windows:** `npm test` goes through `scripts/vitest.mjs`, which fixes a Vitest bug when the terminal's drive letter is lowercase (`c:\…`).

## Documentation

- User guides by role: [Kazakh](docs/user-guide.kk.md) · [Russian](docs/user-guide.ru.md)
- Deploying the demo to Vercel (Turso + Vercel Blob): [docs/deploy-vercel.md](docs/deploy-vercel.md)
- Security and personal data (Law of the RK No. 94-V), including the deployment checklist: [docs/security.md](docs/security.md)
- Data model, grading, progression, certificates and the admin cabinet: [docs/data-model.md](docs/data-model.md)
- Design system and wireframes: [docs/design/](docs/design/)

**Before going live:** use HTTPS behind a reverse proxy that overwrites `X-Forwarded-For`, set `APP_URL=https://…`, host in Kazakhstan, set `SEED_DEMO=false` and a strong `SEED_ADMIN_PASSWORD`, and back up the database and `uploads/`. See [docs/security.md](docs/security.md) §5.

## Backups

Admins create backups on **/admin/backups**. Each one is a consistent copy of the SQLite database, written with `VACUUM INTO` while the app keeps running, into `BACKUP_DIR` (default `./backups`, which git ignores). A backup holds everyone's data, so keep downloaded copies safe.

Restoring is deliberately not a button:

1. Stop the app.
2. Replace `prisma/dev.db` with the backup file, and delete any `prisma/dev.db-wal` and `prisma/dev.db-shm` files.
3. Start the app again.

## Roadmap

| Stage | Scope                                               | Status |
| ----- | --------------------------------------------------- | ------ |
| 0     | Design system, isometric art, UX wireframes         | ✅     |
| 1     | Project scaffold (this)                             | ✅     |
| 2     | Data model and seed                                 | ✅     |
| 3     | Auth and roles                                      | ✅     |
| 4     | Isometric city engine                               | ✅     |
| 5     | Task player (all task types)                        | ✅     |
| 6     | Grading and building progression                    | ✅     |
| 7     | Teacher cabinet                                     | ✅     |
| 8     | Rewards and decorations                             | ✅     |
| 9     | Parent cabinet and notifications                    | ✅     |
| 10    | Analytics                                           | ✅     |
| 11    | Certificates (PDF + QR + verify page)               | ✅     |
| 12    | Admin cabinet                                       | ✅     |
| 13    | Security, responsiveness, QA (Playwright, spec §14) | ✅     |
