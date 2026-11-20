import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CertificateStatus } from "@/components/certificates/certificate-status";
import { requireRole } from "@/lib/auth/guards";
import { getCertificateView } from "@/lib/certificates/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.student");
  return { title: t("certificate") };
}

/** «СӨЗҚАЛАНЫҢ БАС СӘУЛЕТШІСІ» (spec §7): requirements, then the PDF and the verify link. */
export default async function StudentCertificatePage() {
  const user = await requireRole("STUDENT");
  const [view, t] = await Promise.all([getCertificateView(user, user.id), getTranslations("certificate")]);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h1>
        <p className="text-muted">{t("intro")}</p>
      </div>
      <CertificateStatus view={view} />
    </div>
  );
}
