import "server-only";
import { z } from "zod";

/** Server-side environment, validated once at first import. Fails fast with a readable error. */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .regex(/^(file:|libsql:\/\/|https:\/\/)/, "must be file:./prisma/dev.db or a Turso URL (libsql://…)"),
  /** Turso auth token (only for a libsql:// database, e.g. on Vercel). */
  DATABASE_AUTH_TOKEN: z.string().optional(),
  APP_URL: z.url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(32, "must be at least 32 characters (run `npm run setup` to generate one)"),
});

// On Vercel, APP_URL defaults to the production domain (QR codes on certificates point there).
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
// `next build` imports server modules to collect page data but never queries the
// database or signs sessions, so a build must not need the secrets (Vercel builds
// without them). Placeholders are used ONLY while building; at runtime the real
// values are required and validated as before.
const building = process.env.NEXT_PHASE === "phase-production-build";
const parsed = schema.safeParse({
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || (building ? "file:./build-placeholder.db" : undefined),
  AUTH_SECRET: process.env.AUTH_SECRET || (building ? "build-time-placeholder-not-a-real-secret" : undefined),
  APP_URL: process.env.APP_URL || (vercelUrl ? `https://${vercelUrl}` : undefined),
});

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment variables (see .env.example):\n${issues}`);
}

export const env = parsed.data;
