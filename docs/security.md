# Security and personal data (spec §11)

This is the checklist for the platform's code and its operator (the school or organisation that runs it). Items marked **[operator]** depend on how and where the app is deployed, so the code alone can't guarantee them.

## 1. Transport and browser

| Requirement | How it is met |
|---|---|
| HTTPS **[operator]** | Run behind a reverse proxy (nginx, Caddy) that terminates TLS, and set `APP_URL=https://…`. The app then adds `Strict-Transport-Security` (2 years) and the CSP's `upgrade-insecure-requests`. |
| Content-Security-Policy | `proxy.ts` sends a fresh nonce on every request. Scripts must be `'self'` with that nonce (`'strict-dynamic'`); there is no `unsafe-eval` in production. Also set: `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`. Inline styles are allowed because charts and the city use computed `style` attributes. |
| Other headers | Set in `next.config.ts`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (microphone is the only one allowed, for audio answers), `Cross-Origin-Opener-Policy: same-origin`, and no `X-Powered-By`. |
| Checked by | `tests/e2e/security.spec.ts`: the headers, that a new nonce appears on every request, and that pages work with no CSP violations. |

## 2. Authentication

- Passwords are hashed with Argon2id (`@node-rs/argon2`, 19 MiB memory, 2 passes) and never stored or logged in plain text.
- Temporary passwords (from a teacher or admin) are shown once and never stored readable.
- Sessions: an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production) holds an HS256-signed token pointing to a `Session` row. Logging out, resetting a password, deactivating the user or changing their role deletes the rows, so the user is signed out at once.
- Brute force protection:
  - At most N failed logins per account in 15 minutes (admin setting, default 5).
  - At most 30 failed logins per IP address in 15 minutes.
  - At most 20 invite-code registrations per IP address per hour.
  - The response time doesn't reveal whether a login exists (a dummy hash is checked).
- **[operator]** The IP-based limits trust `X-Forwarded-For`. The reverse proxy must overwrite that header (nginx: `proxy_set_header X-Forwarded-For $remote_addr;`), and the app must not be reachable directly.

## 3. Authorization (roles)

- Every page calls `requireRole()` and every Server Action calls `authorize(roles, { write })`. Layouts are not trusted on their own.
- Parents are read-only: every write action requires `write: true`, which the PARENT role never passes.
- Student data goes only to the student, their teachers, linked parents and admins (`viewableStudentIds` / `assertCanViewStudent`). For anyone else the answer is "not found", so nothing is revealed.
- Answer keys never reach the browser before the attempt is graded (an e2e test checks the HTML).
- Files (audio answers, materials) and certificate PDFs are only served by API routes after a permission check, never as static files.
- Admin reads re-check the role (`assertAdmin`). Backups can only be downloaded by an admin, and their file names are checked against a strict pattern (no `../`).

## 4. Personal data (Law of the RK No. 94-V "On personal data and their protection")

| Requirement | Status |
|---|---|
| **Notice** | `/privacy` (kk/ru) explains the purpose, what data is collected, who sees it, storage, retention and the user's rights. It is linked from the landing, login and registration pages. |
| **Consent** | Invite-code registration requires a consent checkbox ("with a parent's permission" for minors). The consent and the notice version (`lib/privacy.ts`) are written to the audit log (`auth.register`). **[operator]** For accounts that teachers or admins create, the school collects parental consent. |
| **Data minimisation** | Collected: name, login, school and class, task answers (text and audio), scores and rewards, parent links, and IP and user agent in sessions and the audit log. Not collected: IIN, address, phone, photos. E-mail is optional and not used yet. |
| **No public disclosure** | The certificate verify page shows only validity, serial, tier and date. The page is `noindex`, and its code is 12 random bytes, so it can't be guessed. There are no public profiles. |
| **Localisation (art. 12-2)** **[operator]** | The database (`prisma/dev.db`), uploads and backups must be kept on servers in Kazakhstan. |
| **Access, correction, erasure** | Teachers and admins correct names. An admin deletes an account with **Delete account** (`/admin/users/[id]`): the city, answers, audio files, rewards, certificates and notifications are removed. The audit entry keeps only the id and role. Authors of classes or tasks can be blocked instead. |
| **Retention** **[operator]** | Delete accounts when studies end or on request. Backups should be rotated, because an old backup still holds deleted users. |
| **Change history** | The audit log records logins, grading, changes to users and settings, certificate actions and backups (`/admin/logs`). |
| **Error log** | `ErrorLog` (written from `instrumentation.ts`) stores the path without the query string, the method and the stack. It never stores headers, cookies or bodies. |
| **Backups** | Admins create and download consistent copies at `/admin/backups`. **[operator]** Store them encrypted and only in Kazakhstan. |

## 5. Deploying: checklist **[operator]**

1. Generate a long random `AUTH_SECRET` (`npm run setup` does this) and keep `.env` out of git.
2. Set `APP_URL=https://your-domain` (QR codes and HSTS depend on it).
3. Put a TLS reverse proxy in front of the app, have it overwrite `X-Forwarded-For`, and keep port 3000 closed to the outside.
4. Host in Kazakhstan and back up `prisma/dev.db` plus `uploads/` regularly (`/admin/backups` handles the database; copy `uploads/` with the same rotation).
5. Seed with `SEED_DEMO=false` and a strong `SEED_ADMIN_PASSWORD` (or change the default `admin12345` right away at `/account`).
6. Review `/admin/logs` (errors) regularly.
