import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { cabinetRoleOf, homeFor } from "./lib/auth/roles";
import { SESSION_COOKIE, verifySessionToken } from "./lib/auth/token";

const intl = createMiddleware(routing);

/**
 * 1. Optimistic auth for cabinets (/student, /teacher, /parent, /admin): only the
 *    signed cookie is checked here — no database. The real check happens again
 *    on the server in every page and action (lib/auth/guards.ts).
 *    - no valid token → /{locale}/login?next=…
 *    - wrong role     → the user's own cabinet
 *    /login is never redirected here (a token can outlive its deleted session);
 *    the login page itself checks the database.
 * 2. Locale routing (next-intl): / → /kk, adds the locale header.
 * 3. Content-Security-Policy with a fresh nonce per request (spec §11). Next.js
 *    reads the nonce from the request's CSP header and puts it on its own scripts;
 *    next-intl forwards the request headers, so the nonce reaches the renderer.
 */
export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const [, locale, ...rest] = pathname.split("/");

  if (hasLocale(routing.locales, locale)) {
    const path = `/${rest.join("/")}`;
    const owner = cabinetRoleOf(path);
    if (owner) {
      const claims = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
      if (!claims) {
        const url = new URL(`/${locale}/login`, request.url);
        url.searchParams.set("next", path + search);
        return NextResponse.redirect(url);
      }
      if (claims.role !== owner) {
        return NextResponse.redirect(new URL(`/${locale}${homeFor(claims.role)}`, request.url));
      }
    }
  }

  const nonce = btoa(crypto.randomUUID());
  const policy = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", policy);
  const response = intl(new NextRequest(request, { headers }));
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

/**
 * Scripts: only ours (nonce + strict-dynamic for the chunks they load).
 * Styles: inline style attributes are used for computed geometry (charts, city), so 'unsafe-inline' stays for styles only.
 * Media/images: blob: for audio recordings before upload, data: for small inline images.
 */
function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV !== "production";
  const https = (process.env.APP_URL ?? "").startsWith("https://") || Boolean(process.env.VERCEL);
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export const config = {
  // Everything except API routes, Next.js internals and files with an extension (images, favicon, ...).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
