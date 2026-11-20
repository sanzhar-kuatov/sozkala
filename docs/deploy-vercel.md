# Deploying the demo to Vercel

On Vercel the app uses:

- **Turso**, a hosted SQLite database. The app's libSQL driver connects to it directly. Vercel's own disk is wiped between requests, so the local `prisma/dev.db` file can't be used.
- **Vercel Blob** (a **private** store) for audio answers and task materials.
- Database **backups come from Turso**, so `/admin/backups` explains this instead of creating files.

> **Demo only.** Vercel and Turso host data outside Kazakhstan. Under Law No. 94-V (art. 12-2), real students' personal data must be stored in Kazakhstan. Use the demo school here, and use a server in Kazakhstan for real classes (see `docs/security.md`).

The commands below are for the VS Code terminal (PowerShell) in the project folder. Free plans are enough.

## 1. Create the Turso database

1. Sign up at **turso.tech** (you can sign in with GitHub).
2. Create a database (for example `sozqala`) in the region **Frankfurt (aws-eu-central-1)**. It's close to Kazakhstan and to the Vercel region in `vercel.json` (`fra1`).
3. On the database page, copy:
   - the **URL**, which looks like `libsql://sozqala-yourname.aws-eu-central-1.turso.io`
   - a **token**: *Create Token* → read & write → copy it.
4. In the project folder, create a file named **`.env.turso`**. It's git-ignored and never uploaded.

   ```
   DATABASE_URL="libsql://sozqala-yourname.aws-eu-central-1.turso.io"
   DATABASE_AUTH_TOKEN="eyJhbGciOi..."
   ```

5. Create the tables and load the demo school (this takes about a minute):

   ```
   npm run db:remote:seed
   ```

   Later, after a code update that adds a migration, run `npm run db:remote` (tables only, demo data untouched). Run `db:remote:seed` again whenever you want to reset the demo data.

## 2. Create the Vercel project

1. Sign up at **vercel.com**.
2. Log in from the terminal and link the folder to a new project:

   ```
   npx vercel login
   npx vercel link
   ```

   Answer the questions: *Set up and deploy?* → yes, your account, *Link to existing project?* → no, project name `sozqala`. The settings from `vercel.json` (Next.js, `npm ci`, region `fra1`) are picked up automatically.

## 3. Add the file storage (Vercel Blob)

In the Vercel dashboard, open project **sozqala** → **Storage** → **Create** → **Blob**. Choose **Private** access and connect it to the project (all environments). Vercel then adds `BLOB_READ_WRITE_TOKEN` to the project by itself.

## 4. Set the environment variables

Project → **Settings** → **Environment Variables**. Add these for **Production** (and Preview, if you use previews):

| Name | Value |
|---|---|
| `DATABASE_URL` | the `libsql://…` URL from step 1 |
| `DATABASE_AUTH_TOKEN` | the Turso token from step 1 |
| `AUTH_SECRET` | a new random secret. Generate it with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `APP_URL` | *optional.* Without it, the app uses your `https://….vercel.app` production address (certificate QR codes point there). Set it if you add your own domain. |

## 5. Deploy

```
npx vercel --prod
```

The build takes about 2 minutes. At the end you get the address, e.g. `https://sozqala.vercel.app`. Open it and log in with the demo accounts:

| Role | Login | Password |
|---|---|---|
| Admin | `admin` | `admin12345` |
| Teacher | `teacher` | `demo12345` |
| Students | `aruzhan`, `alina`, `damir`, `madina`, `timur` | `demo12345` |
| Parents | `parent`, `parent2` | `demo12345` |

Since the site is public, **change the admin password right away**: log in as `admin` → click your name at the top → *Change password*.

## Updating the site later

```
npx vercel --prod
```

If the update added a database migration (a new folder in `prisma/migrations`), run `npm run db:remote` **first**.

## If something goes wrong

- **Build error "Invalid environment variables"**: a variable from step 4 is missing or misspelled (it must be `DATABASE_URL`, not `TURSO_DATABASE_URL`). Fix it, then redeploy.
- **Error pages after deploying**: check *Vercel → project → Logs*. The app's own error log is at `/admin/logs?tab=errors`.
- **Audio answer or material upload fails**: the Blob store isn't connected (step 3), or it was created as *Public*. Create a *Private* store instead.
- **Logged out right after logging in**: `AUTH_SECRET` changed between deployments. Set it once and keep it.
