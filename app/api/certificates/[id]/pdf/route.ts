import { getTranslations } from "next-intl/server";
import { AuthError, authorize } from "@/lib/auth/guards";
import { renderCertificatePdf } from "@/lib/certificates/pdf";
import { getCertificateForDownload } from "@/lib/certificates/service";
import { env } from "@/lib/env";

/**
 * GET /api/certificates/<id>/pdf?lang=kk|ru — the certificate as a PDF (spec §7, acceptance #10).
 * Allowed for anyone who may see the student: the student, a linked parent, their teacher, an admin.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/certificates/[id]/pdf">) {
  try {
    const user = await authorize();
    const cert = await getCertificateForDownload(user, (await params).id);
    const lang = new URL(request.url).searchParams.get("lang");
    const locale = lang === "ru" || lang === "kk" ? lang : user.locale;
    const t = await getTranslations({ locale, namespace: "certificate" });

    const pdf = await renderCertificatePdf({
      snapshot: cert.snapshot,
      serial: cert.serial,
      tier: cert.tier,
      finalScore: cert.finalScore,
      issuedAt: new Intl.DateTimeFormat(locale === "kk" ? "kk-KZ" : "ru-RU", {
        timeZone: "Asia/Almaty",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(cert.issuedAt),
      verifyUrl: `${env.APP_URL}/${locale}/verify/${cert.verifyCode}`,
      locale,
      labels: {
        brand: t("pdf.brand"),
        heading: t("pdf.heading"),
        awardedTo: t("pdf.awardedTo"),
        body: t("pdf.body"),
        finalScore: t("finalScore"),
        issued: t("issued"),
        verify: t("pdf.verify"),
        tier: t(`tiers.${cert.tier}`),
      },
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${cert.serial}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return new Response(null, { status: 404 });
    throw error;
  }
}
