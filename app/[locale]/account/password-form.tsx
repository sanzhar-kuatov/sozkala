"use client";

import { Check, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { changePassword, type PasswordState } from "./actions";

export function PasswordForm() {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, undefined);
  return (
    <form action={action} className="grid max-w-md gap-4">
      <Field id="current" label={t("current")}>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field id="next" label={t("next")} hint={t("nextHint")}>
        <Input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field id="confirm" label={t("confirm")}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      {state?.error && (
        <p role="alert" className="rounded-md bg-coral-100 px-3 py-2 text-sm font-bold text-coral-700">
          {t(`errors.${state.error}`)}
        </p>
      )}
      {state?.ok && !pending && (
        <p role="status" className="flex items-center gap-1.5 text-sm font-bold text-grass-700">
          <Check className="size-4" aria-hidden />
          {t("changed")}
        </p>
      )}
      <Button type="submit" disabled={pending} className="justify-self-start">
        <KeyRound aria-hidden />
        {t("submit")}
      </Button>
    </form>
  );
}
