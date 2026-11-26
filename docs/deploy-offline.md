# Running Сөзқала offline (school network, no internet)

This guide installs Сөзқала on **one school computer (the "server")**. Students and teachers open it in a browser from any computer, tablet or phone on the **same Wi-Fi or school network**. Once installed, nothing needs the internet: the database, fonts, PDFs and QR codes are all local.

> **Personal data:** everything stays on the server computer inside the school, so this setup meets the Kazakhstan data-location rule (law 94-V, art. 12-2). Protect that computer: give it a Windows password and back it up (step 9).

---

## What you need

| | |
|---|---|
| **Server computer** | Windows 10/11, 64-bit, 4 GB RAM or more, 5 GB free disk, switched on during lessons |
| **Preparation computer** | Your laptop **with internet**, also **Windows**. The app is built there, because building downloads packages and fonts |
| **A USB stick** | 2 GB or more |
| **Network** | Server and student devices on the same router or Wi-Fi. The internet connection itself is not needed |

> **Both computers must run Windows.** Some packages (the database driver, password hashing) are compiled for the operating system. A folder built on Windows does not run on Linux or macOS. To use a Linux server, build on that Linux machine while it has internet, then disconnect it.

---

## Part A — on your laptop (with internet)

### 1. Build the app

Open PowerShell in the project folder (`teaching_platform`):

```powershell
git pull                 # latest code, if you keep it on GitHub
npm ci                   # installs exactly the packages in package-lock.json
npm run build            # production build (downloads the two fonts once)
```

`npm run build` must end with a list of routes and no `Error`. Check that `.env` on the laptop has `APP_URL` starting with **`http://`**, not `https://`. The build reads it, and an `https` value would make browsers insist on HTTPS, which the school network doesn't have.

### 2. Download the Node.js installer

From https://nodejs.org download the **Windows Installer (.msi), version 22 LTS, x64**. Copy it to the USB stick.

### 3. Copy the project to the USB stick

Copy the **whole `teaching_platform` folder**, including `node_modules`, `.next` and `generated`. It is several hundred MB.

Leave these out (they are your laptop's data, not the school's): `.env`, `.env.turso`, `prisma/dev.db*`, `prisma/e2e.db*`, `uploads/`, `backups/`, `backups-e2e/`, `test-results/`, `.git/`.

A quick way, run from the folder **above** `teaching_platform` (replace `E:` with your USB drive letter):

```powershell
robocopy teaching_platform E:\sozqala /E /XD .git uploads backups backups-e2e test-results playwright-report /XF .env .env.turso dev.db dev.db-wal dev.db-shm e2e.db e2e.db-wal e2e.db-shm
```

---

## Part B — on the server computer (no internet needed)

### 4. Install Node.js and copy the app

1. Run the Node.js `.msi` from the USB stick (accept the defaults).
2. Copy `sozqala` from the USB stick to **`C:\sozqala`**. Keep the path short and without spaces.

### 5. Give the server a fixed address

Students will type the server's address, so it must not change.

1. Find the current address: PowerShell → `ipconfig`. Look for **IPv4 Address**, e.g. `192.168.1.10`.
2. Keep it fixed. The easiest way is in the **router's settings**: "DHCP reservation" / "Static lease" for this computer. Alternatively, set a static IP in Windows network settings. If you are unsure, ask whoever manages the school network.

In the rest of this guide, replace `192.168.1.10` with your address.

### 6. Create the settings file and the database

Open **PowerShell as administrator** and run:

```powershell
cd C:\sozqala
$env:SEED_DEMO = "false"                      # no demo students; use "true" for a practice install
$env:SEED_ADMIN_PASSWORD = "ChooseAStrongPassword-2026"
npm run setup
```

`npm run setup` creates `.env` (with a random secret key), the database `prisma\dev.db` and the first **admin** account (login `admin`, with the password above).

Then open `C:\sozqala\.env` in Notepad and change `APP_URL` to the server's address:

```
APP_URL="http://192.168.1.10:3000"
```

(`APP_URL` is used for the QR codes on certificates. With `http://`, login works over the school network.)

### 7. Start it and open it from another device

Still in PowerShell (as administrator):

```powershell
# allow other devices on the school network to reach port 3000
New-NetFirewallRule -DisplayName "Sozqala" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private,Domain

cd C:\sozqala
npm start -- -H 0.0.0.0 -p 3000
```

Wait for `Ready`, then on **another** device on the same network open **http://192.168.1.10:3000**.

If it doesn't open:
- **Windows network profile:** *Settings → Network → your connection → Network profile type = Private.* The firewall rule above applies only to Private and Domain networks.
- **On the server itself**, http://localhost:3000 should open. If it opens there but not on other devices, it is the firewall or the network ("client isolation" on guest Wi-Fi blocks devices from seeing each other).

Stop it with `Ctrl + C` before the next step.

### 8. Start it automatically when the computer turns on

1. Create `C:\sozqala\start-sozqala.bat` in Notepad with:

   ```bat
   @echo off
   cd /d C:\sozqala
   "C:\Program Files\nodejs\node.exe" node_modules\next\dist\bin\next start -H 0.0.0.0 -p 3000 >> C:\sozqala\server.log 2>&1
   ```

2. Open **Task Scheduler** → *Create Task…*
   - **General:** name `Sozqala`; choose *Run whether user is logged on or not*; tick *Run with highest privileges*.
   - **Triggers:** *New… → Begin the task: At startup*.
   - **Actions:** *New… → Start a program →* `C:\sozqala\start-sozqala.bat`.
   - **Settings:** untick *Stop the task if it runs longer than…*; tick *If the task fails, restart every 1 minute*.
3. Restart the computer and check http://192.168.1.10:3000 from another device. Errors, if any, go to `C:\sozqala\server.log`.

Also set **Power options → Sleep: Never**, otherwise the site disappears when the computer sleeps.

### 9. Back up

All school data is two things: the database and the `uploads` folder (students' audio answers and task pictures).

- **Database:** log in as admin → **Резервные копии / Backups** → *Make a copy now*. Copies go to `C:\sozqala\backups`.
- **Weekly:** copy `C:\sozqala\backups` (the newest file) **and** `C:\sozqala\uploads` to a USB stick or another computer. A backup on the same computer won't survive a disk failure.

**Restoring** (after a disk failure or a mistake):
1. Stop the app: in Task Scheduler, right-click `Sozqala` → *End*.
2. Replace `C:\sozqala\prisma\dev.db` with the backup file (rename it to `dev.db`), and delete `dev.db-wal` and `dev.db-shm` if they exist.
3. Put the `uploads` folder back.
4. Start the task again (right-click → *Run*).

---

## Part C — first use

1. Open http://192.168.1.10:3000, log in as **`admin`** with the password from step 6.
2. **Admin → Schools:** add your school.
3. **Admin → Users → create account:** a **teacher** account for each teacher (the password is shown once; write it down or give it to the teacher, who then changes it in *My account*).
4. **Load the ready-made tasks** (the 40 variants from the documents) for one teacher. Run this on the server, in PowerShell:

   ```powershell
   cd C:\sozqala
   npm run tasks:import -- --author TEACHER_LOGIN
   ```

   This also works offline. The tasks appear in that teacher's **Tasks** list, published but not assigned.
5. The teacher logs in, creates a class (**Classes → New class**, with its grade 5–11), adds students (accounts are created on the spot, or students join themselves at `/join/CODE`), and assigns tasks (**Tasks → task → «Кімге» / «Кому»**).

---

## Updating to a new version

1. On the laptop (with internet): repeat **step 1** (`git pull`, `npm ci`, `npm run build`).
2. On the server: make a backup (step 9), then stop the task in Task Scheduler.
3. Copy the new folder over `C:\sozqala`, **without** overwriting `.env`, `prisma\dev.db*`, `uploads\` and `backups\`. Use the same `robocopy` command as in step 3 with `C:\sozqala` as the target: it skips exactly those files.
4. Apply database changes: `cd C:\sozqala` then `npx prisma migrate deploy` (it prints "No pending migrations" if there are none).
5. Start the task again.

---

## Things that work differently offline

| | |
|---|---|
| **Audio answers (microphone)** | Browsers allow the microphone only over HTTPS or on the server itself (`localhost`). Over `http://192.168.1.10` recording is blocked. Workaround for school computers with Chrome: open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, enter `http://192.168.1.10:3000`, set it to *Enabled*, restart Chrome. On phones this isn't practical, so skip audio tasks or use the PS Cloud version (HTTPS). |
| **Certificate QR codes** | They point to `http://192.168.1.10:3000/verify/…`, so they can be checked only from inside the school network. |
| **Parents at home** | They can't reach a school-network server from home. Parent accounts are useful only if parents come to school, or with the PS Cloud version. |
| **Password reset by email** | Not used anyway: teachers and admins reset passwords in the app. |

## Troubleshooting

| Problem | Fix |
|---|---|
| Page opens but **login returns to the login page** | `APP_URL` in `.env` must start with `http://` (step 6). Restart the app after editing `.env`. |
| `Invalid environment variables` in `server.log` | `.env` is missing or `AUTH_SECRET` is empty. Run `npm run setup` again (it keeps existing values). |
| `EADDRINUSE: port 3000` | The app is already running (maybe started twice). Restart the computer, or use another port in the `.bat` file, in `APP_URL` and in the firewall rule. |
| `Error: Cannot find module …libsql…win32…` | The folder was built on a different operating system. Build on Windows (step 1). |
| Everything slow | Close other programs on the server. One ordinary PC handles a school easily; slowness usually means the server is asleep or the Wi-Fi is overloaded. |
