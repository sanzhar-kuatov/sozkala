"use client";

import { Check, RotateCcw, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { TIER_COLOR, TIERS, type Policy } from "@/lib/certificates/rules";
import { resetCertificatePolicy, saveCertificatePolicy, type PolicyResult } from "./actions";

const FIELD = { BRONZE: "bronzeMin", SILVER: "silverMin", GOLD: "goldMin", PLATINUM: "platinumMin" } as const;

export function PolicyForm({ classId, policy, own }: { classId: string; policy: Policy; own: boolean }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<PolicyResult, FormData>(
    saveCertificatePolicy.bind(null, classId),
    undefined,
  );

  return (
    <div className="grid gap-3">
      <form action={action} className="grid gap-4">
        {/* remount the inputs when the saved policy changes (e.g. after a reset), keep the form state */}
        <div key={JSON.stringify(policy)} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TIERS.map((tier) => (
              <label key={tier} className="grid gap-1 text-sm font-extrabold">
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full" style={{ background: TIER_COLOR[tier] }} aria-hidden />
                  {t(`certificate.tiers.${tier}`)}
                </span>
                <Input
                  type="number"
                  name={FIELD[tier]}
                  min={0}
                  max={10}
                  step={0.1}
                  required
                  defaultValue={policy[FIELD[tier]]}
                  className="min-h-10 py-2"
                />
              </label>
            ))}
          </div>
          <label className="grid max-w-xs gap-1 text-sm font-extrabold">
            {t("certificate.teacher.minLevel")}
            <Select name="minBuildingLevel" defaultValue={policy.minBuildingLevel} className="min-h-10">
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  L{n} · {t(`levels.${n as 1 | 2 | 3 | 4 | 5}`)}
                </option>
              ))}
            </Select>
          </label>
        </div>
        {state?.error && (
          <p role="alert" className="rounded-md bg-coral-100 px-3 py-2.5 text-sm font-bold text-coral-700">
            {t(`certificate.teacher.errors.${state.error}`)}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {state?.ok && !pending && (
            <span role="status" className="inline-flex items-center gap-1.5 text-sm font-bold text-grass-700">
              <Check className="size-4" aria-hidden />
              {state.issued ? t("certificate.teacher.savedIssued", { count: state.issued }) : t("teacher.saved")}
            </span>
          )}
          <Button type="submit" disabled={pending}>
            <Save aria-hidden />
            {t("teacher.save")}
          </Button>
        </div>
      </form>
      {own && (
        <form action={resetCertificatePolicy.bind(null, classId)} className="flex justify-end">
          <Button type="submit" variant="ghost" size="sm">
            <RotateCcw aria-hidden />
            {t("certificate.teacher.reset")}
          </Button>
        </form>
      )}
    </div>
  );
}
