# Deploying Сөзқала on PS Cloud (Kazakhstan)

This guide puts Сөзқала on the internet at your own address, e.g. **https://sozqala.kz**, on a virtual server (VPS) from PS Cloud Services. The server sits in a Kazakhstan data centre, so this setup can hold **real student data** (law 94-V, art. 12-2). The Vercel site stays a demo.

Everything runs on one server:

```
students' browsers ──HTTPS──▶ Caddy (port 443, free automatic certificate)
                                  │
                                  ▼
                       Сөзқала app (Node.js, port 3000, only reachable inside the server)
                                  │
                     prisma/dev.db (SQLite database)   uploads/ (audio, task files)
```

No Turso and no Vercel Blob: the database is a file on the server's disk.

Time needed: about 1 hour the first time. You type commands into a terminal; each block can be copied as a whole.

---

## 1. Order the server and a domain

**VPS** (in the PS Cloud control panel → *Cloud servers / VPS*):

| Setting | Choose |
|---|---|
| Operating system | **Ubuntu 24.04 LTS** |
| Size | **2 vCPU, 4 GB RAM, 40 GB SSD** (2 GB RAM is enough for a demo or one class) |
| Location | Kazakhstan (Almaty or Astana) |
| Access | add your **SSH key** if the panel offers it, otherwise note the **root password** |

Note the server's **public IP address**, e.g. `185.22.xx.xx`.

**Domain:** register one (e.g. `sozqala.kz`, at ps.kz or any registrar). In its **DNS settings** add:

| Type | Name | Value |
|---|---|---|
| A | `@` (the domain itself) | the server IP |
| A | `www` | the server IP |

DNS changes can take from a few minutes to a few hours. Continue meanwhile. Only step 9 (HTTPS) needs it.

In this guide, replace **`sozqala.kz`** with your domain and **`185.22.xx.xx`** with your IP.

---

## 2. Connect to the server

On your Windows laptop, open PowerShell:

```powershell
ssh root@185.22.xx.xx
```

Type `yes` the first time, then the root password (typing is invisible; that's normal). The prompt changes to `root@…:~#`. **All commands from here on run on the server.**

---

## 3. Update the system and create an app user

```bash
apt update && apt upgrade -y
apt install -y git sqlite3 curl ufw unzip
adduser --disabled-password --gecos "" sozqala      # the app runs as this user, not as root
timedatectl set-timezone Asia/Almaty
```

## 4. Firewall

Allow only SSH and the web ports. Port 3000 stays closed to the outside.

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

## 5. Swap (extra memory for the build)

Building the app needs about 2 GB of memory. Swap avoids "out of memory" on small servers:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 6. Install Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v          # must print v22.x
```

---

## 7. Get the code onto the server

Switch to the app user:

```bash
su - sozqala
```

**Option A — from GitHub** (the repository is `github.com/sanzhar-kuatov/sozkala`):

```bash
git clone https://github.com/sanzhar-kuatov/sozkala.git app
```

If the repository is **private**, git asks for a username and password. Use your GitHub username and a **personal access token** as the password (GitHub → Settings → Developer settings → Personal access tokens → *Fine-grained*, read access to this repository only).

**Option B — upload a zip from your laptop.** Commit your work first, then in PowerShell **on the laptop**, in the project folder:

```powershell
git archive --format=zip -o sozqala.zip HEAD
scp sozqala.zip root@185.22.xx.xx:/home/sozqala/
```

Then on the server (as `sozqala`):

```bash
unzip ~/sozqala.zip -d ~/app
```

---

## 8. Settings, database, build

Still as user `sozqala`:

```bash
cd ~/app
npm ci
```

Create the settings file. Change the domain on the second line:

```bash
cat > .env <<EOF
DATABASE_URL="file:./prisma/dev.db"
APP_URL="https://sozqala.kz"
AUTH_SECRET="$(openssl rand -base64 36)"
EOF
chmod 600 .env
```

Create the database and the first admin. The password is asked for without echoing, so it doesn't end up in the command history:

```bash
read -rsp "New admin password: " SEED_ADMIN_PASSWORD; echo
export SEED_ADMIN_PASSWORD SEED_DEMO=false
npm run setup
unset SEED_ADMIN_PASSWORD
```

`SEED_DEMO=false` means no demo students. For a practice server you may use `SEED_DEMO=true`, but never on a server with real students: the demo passwords are public.

Build:

```bash
npm run build
```

It must end with a route list and no `Error`. Then go back to root:

```bash
exit
```

---

## 9. Run the app as a service

As **root**, create the service file:

```bash
cat > /etc/systemd/system/sozqala.service <<'EOF'
[Unit]
Description=Sozqala
After=network.target

[Service]
User=sozqala
WorkingDirectory=/home/sozqala/app
Environment=NODE_ENV=production
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now sozqala
systemctl status sozqala --no-pager     # should say "active (running)"
curl -s http://127.0.0.1:3000/api/health  # {"ok":true,"db":"up"}
```

The app now starts by itself after every reboot and restarts if it crashes.

## 10. HTTPS with Caddy

Caddy is a web server that gets and renews the HTTPS certificate (Let's Encrypt) on its own.

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

Write its configuration (change both domains):

```bash
cat > /etc/caddy/Caddyfile <<'EOF'
sozqala.kz {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}

www.sozqala.kz {
	redir https://sozqala.kz{uri} permanent
}
EOF

systemctl reload caddy
```

Open **https://sozqala.kz**. The first visit can take ~30 seconds while the certificate is issued. If it fails, the DNS records from step 1 probably don't point to the server yet. Check with `ping sozqala.kz` (it should show your IP), wait, then `systemctl reload caddy`.

Caddy also replaces the `X-Forwarded-For` header with the real visitor address, which the login limits and the audit log rely on.

---

## 11. Automatic nightly backups

Each night at 02:30 this makes a consistent copy of the database (it also appears on the admin **Backups** page) and an archive of `uploads/`, and keeps 14 days of each.

```bash
cat > /usr/local/bin/sozqala-backup <<'EOF'
#!/bin/sh
set -e
cd /home/sozqala/app
mkdir -p backups backups/uploads
sqlite3 prisma/dev.db ".backup backups/sozqala-$(date +%Y%m%d-%H%M%S).db"
[ -d uploads ] && tar -czf "backups/uploads/uploads-$(date +%Y%m%d).tar.gz" uploads
find backups -maxdepth 1 -name 'sozqala-*.db' -mtime +14 -delete
find backups/uploads -name 'uploads-*.tar.gz' -mtime +14 -delete
EOF
chmod +x /usr/local/bin/sozqala-backup
echo '30 2 * * * sozqala /usr/local/bin/sozqala-backup' > /etc/cron.d/sozqala-backup
sudo -u sozqala /usr/local/bin/sozqala-backup && ls -lh /home/sozqala/app/backups   # test it now
```

**Keep a copy off the server** too, e.g. once a week on your laptop:

```powershell
scp -r root@185.22.xx.xx:/home/sozqala/app/backups D:\sozqala-backups
```

If PS Cloud offers disk **snapshots** or backups for the VPS, turn them on as well.

**Restoring:**

```bash
systemctl stop sozqala
cd /home/sozqala/app
cp backups/sozqala-YYYYMMDD-HHMMSS.db prisma/dev.db && rm -f prisma/dev.db-wal prisma/dev.db-shm
tar -xzf backups/uploads/uploads-YYYYMMDD.tar.gz     # only if uploads were lost
chown -R sozqala:sozqala prisma uploads
systemctl start sozqala
```

---

## 12. First use

1. Open https://sozqala.kz → log in as **`admin`** with the password from step 8 → check **Admin → Overview**.
2. **Admin → Schools:** add your school.
3. **Admin → Users → create account:** a **teacher** account for each teacher. The password is shown once; the teacher changes it at **My account**.
4. **Load the 40 ready-made tasks** for one teacher (as root):

   ```bash
   sudo -u sozqala sh -c 'cd /home/sozqala/app && npm run tasks:import -- --author TEACHER_LOGIN'
   ```

   On this server import **all** variants, including the corrected grammar V1 (no `--except`).
5. The teacher creates classes (with grade 5–11), adds students and assigns tasks.

To move data from the Vercel demo: there is no automatic transfer, and the demo holds only test data. Start the real server clean and re-create classes there.

---

## 13. Updating to a new version

Connect with `ssh root@185.22.xx.xx`, then:

```bash
sudo -u sozqala /usr/local/bin/sozqala-backup        # backup first
systemctl stop sozqala
sudo -u sozqala sh -c 'cd /home/sozqala/app && git pull && npm ci && npx prisma migrate deploy && npm run build'
systemctl start sozqala
curl -s http://127.0.0.1:3000/api/health
```

The site is down for the 2–3 minutes of the build, so update in the evening. (With option B, upload and unzip the new zip over `~/app` instead of `git pull`. Unzipping doesn't touch `.env`, the database, `uploads/` or `backups/`.)

---

## 14. Security checklist

- [ ] `admin` has a strong password (or was changed at **My account** right after the first login).
- [ ] `SEED_DEMO=false` was used (no `aruzhan` / `demo12345` accounts: check **Admin → Users**).
- [ ] `APP_URL` in `.env` is `https://…` (the login cookie and HSTS depend on it).
- [ ] `ufw status` shows only 22, 80, 443.
- [ ] Backups run (`ls /home/sozqala/app/backups`), and a recent copy exists off the server.
- [ ] `apt update && apt upgrade -y` once a month (then `reboot` if it asks).
- [ ] Look at **Admin → Logs → Errors** now and then.
- [ ] Optional: log in with an SSH key and set `PasswordAuthentication no` in `/etc/ssh/sshd_config`.

More detail: [security.md](security.md).

## Troubleshooting

| Symptom | Where to look / fix |
|---|---|
| **502 Bad Gateway** | The app isn't running: `systemctl status sozqala`, then `journalctl -u sozqala -n 50`. |
| `Invalid environment variables` in the log | `.env` is missing a value (step 8). After editing `.env`: `systemctl restart sozqala`. |
| HTTPS doesn't work | `journalctl -u caddy -n 50`. Usually DNS isn't pointing to the server yet, or ports 80/443 are closed in the PS Cloud panel's own firewall (check it there too). |
| Build stops with `Killed` or "heap out of memory" | Not enough memory: check the swap from step 5 (`free -h`). |
| `SQLITE_BUSY` / "database is locked" | Something else holds the database, e.g. a `sqlite3` window left open. Close it. |
| Disk full | `df -h`. Old backups in `backups/` and audio in `uploads/` use the space. |
| Watch the live log | `journalctl -u sozqala -f` (Ctrl + C to stop watching). |
