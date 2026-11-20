import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Cache Components / Partial Prefetching are intentionally OFF: almost every
// page in Сөзқала is per-user, authenticated and database-driven, so we render
// dynamically and keep auth + i18n simple. Revisit for the public landing page.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The certificate PDF reads its fonts from disk at runtime; ship them with that function (Vercel).
  outputFileTracingIncludes: {
    "/api/certificates/[id]/pdf": ["./assets/fonts/**/*"],
  },
  // Security headers for every response (spec §11). The CSP (with a per-request nonce) is set in proxy.ts.
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // microphone: audio answers (spec §5); everything else off
      { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ];
    const https = (process.env.APP_URL ?? "").startsWith("https://") || Boolean(process.env.VERCEL);
    if (process.env.NODE_ENV === "production" && https) {
      headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
    }
    return [{ source: "/:path*", headers }];
  },
  // Native modules (SQLite driver, Argon2): load from node_modules at runtime instead of bundling.
  serverExternalPackages: ["@libsql/client", "libsql", "@node-rs/argon2"],
  // Pin the workspace root (a stray lockfile in the user's home folder would otherwise be picked up).
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
