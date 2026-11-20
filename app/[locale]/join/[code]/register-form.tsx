"use client";

import { Hammer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, hintId, Input } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { registerStudent, type JoinField, type JoinState } from "./actions";

export function RegisterForm({ code }: { code: string }) {
  const t = useTranslations("join");
  const [state, action, pending] = useActionState<JoinState, FormData>(registerStudent.bind(null, code), undefined);
  const err = (f: JoinField) => (state?.errors?.[f] ? t(`errors.${state.errors[f]}`) : undefined);
  const val = (f: JoinField) => state?.values?.[f];

  const input = (f: JoinField, props: React.ComponentProps<typeof Input> = {}) => (
    <Input
      id={f}
      name={f}
      defaultValue={val(f)}
      aria-invalid={Boolean(state?.errors?.[f]) || undefined}
      aria-describedby={hintId(f)}
      {...props}
    />
  );

  return (
    <form action={action} className="grid gap-4" noValidate>
      {state?.formError && (
        <p role="alert" className="rounded-md bg-coral-100 px-3 py-2.5 text-sm font-bold text-coral-700">
          {t(`errors.${state.formError}`)}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label={t("firstName")} error={err("firstName")}>
          {input("firstName", { autoComplete: "given-name", required: true })}
        </Field>
        <Field id="lastName" label={t("lastName")} error={err("lastName")}>
          {input("lastName", { autoComplete: "family-name", required: true })}
        </Field>
      </div>
      <Field id="login" label={t("login")} hint={t("loginHint")} error={err("login")}>
        {input("login", { autoComplete: "username", autoCapitalize: "none", spellCheck: false, required: true })}
      </Field>
      <Field id="password" label={t("password")} hint={t("passwordHint")} error={err("password")}>
        {input("password", { type: "password", autoComplete: "new-password", required: true, defaultValue: undefined })}
      </Field>
      <Field id="confirm" label={t("confirm")} error={err("confirm")}>
        {input("confirm", { type: "password", autoComplete: "new-password", required: true, defaultValue: undefined })}
      </Field>
      <Field id="cityName" label={t("cityName")} hint={t("cityHint")} error={err("cityName")}>
        {input("cityName", { maxLength: 40 })}
      </Field>
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="consent"
          required
          aria-invalid={state?.formError === "consent" || undefined}
          className="mt-0.5 size-4 shrink-0 accent-(--color-primary)"
        />
        <span>
          {t.rich("consent", {
            link: (chunks) => (
              <Link href="/privacy" target="_blank" className="font-bold text-primary-edge">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>
      <Button type="submit" size="lg" variant="accent" disabled={pending}>
        <Hammer aria-hidden />
        {t("submit")}
      </Button>
    </form>
  );
}
