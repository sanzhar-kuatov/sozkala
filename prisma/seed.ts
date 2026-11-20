/**
 * Seed entry point: `npm run db:seed` (also part of `npm run setup` and `npm run db:reset`).
 *
 *   SEED_DEMO=false          skip the demo school (reference data + admin only)
 *   SEED_ADMIN_LOGIN / SEED_ADMIN_PASSWORD   first admin account (default admin / admin12345)
 *   SEED_DEMO_PASSWORD       password for all demo accounts (default demo12345)
 */
import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../generated/prisma/client";
import { seedDemo } from "./seed/demo";
import { seedReference } from "./seed/reference";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");

const db = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN }) });

async function main() {
  console.log("Seeding Сөзқала…");
  await seedReference(db);
  if (process.env.SEED_DEMO !== "false") await seedDemo(db);
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
