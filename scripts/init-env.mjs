// First-run helper (part of `npm run setup`): creates .env from .env.example if
// it does not exist, and fills in AUTH_SECRET with a random value if it is empty.
// Never overwrites values you have set yourself.
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env from .env.example");
}

const env = readFileSync(".env", "utf8");
if (/^AUTH_SECRET=("")?\s*$/m.test(env) || !/^AUTH_SECRET=/m.test(env)) {
  const secret = randomBytes(32).toString("base64url");
  const next = /^AUTH_SECRET=/m.test(env)
    ? env.replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET="${secret}"`)
    : `${env.trimEnd()}\nAUTH_SECRET="${secret}"\n`;
  writeFileSync(".env", next);
  console.log("Generated AUTH_SECRET in .env");
}
