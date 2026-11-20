"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** One-time display of a new login + password (the password is not stored in readable form anywhere). */
export function CredentialsCard({ name, login, password }: { name: string; login: string; password: string }) {
  const t = useTranslations("teacher.credentials");
  const [copied, setCopied] = useState(false);
  const text = `${name}\n${t("login")}: ${login}\n${t("password")}: ${password}`;
  return (
    <div role="status" className="grid gap-2 rounded-md border-2 border-grass-500 bg-grass-100 p-4">
      <p className="flex items-center gap-2 font-bold text-grass-700">
        <KeyRound className="size-4" aria-hidden />
        {name}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-base">
        <dt className="font-sans text-sm font-bold text-muted">{t("login")}</dt>
        <dd className="font-extrabold">{login}</dd>
        <dt className="font-sans text-sm font-bold text-muted">{t("password")}</dt>
        <dd className="font-extrabold">{password}</dd>
      </dl>
      <p className="text-xs font-semibold text-ink-700">{t("once")}</p>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard?.writeText(text).catch(() => {});
          setCopied(true);
        }}
        className="inline-flex cursor-pointer items-center gap-1.5 justify-self-start text-sm font-bold text-grass-700"
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? t("copied") : t("copy")}
      </button>
    </div>
  );
}
