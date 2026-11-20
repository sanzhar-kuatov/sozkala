"use client";

import { CircleAlert, LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, hintId, Input } from "@/components/ui/field";
import { login, type LoginState } from "@/lib/auth/actions";

export type DemoAccount = {
  login: string;
  password: string;
  role: "student" | "teacher" | "parent" | "admin";
  name: string;
};

export function LoginForm({ next, demoAccounts }: { next?: string; demoAccounts: DemoAccount[] }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  const loginRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const fill = (a: DemoAccount) => {
    if (loginRef.current) loginRef.current.value = a.login;
    if (passwordRef.current) passwordRef.current.value = a.password;
    passwordRef.current?.form?.requestSubmit();
  };

  return (
    <>
      <form action={action} className="grid gap-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        {state?.error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-coral-100 px-3 py-2.5 text-sm font-bold text-coral-700"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t(`login.errors.${state.error}`)}
          </p>
        )}
        <Field id="login" label={t("login.loginLabel")} hint={t("login.loginHint")}>
          <Input
            ref={loginRef}
            id="login"
            name="login"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            defaultValue={state?.login}
            aria-describedby={hintId("login")}
            aria-invalid={state?.error === "invalid" || undefined}
          />
        </Field>
        <Field id="password" label={t("login.passwordLabel")}>
          <Input
            ref={passwordRef}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={state?.error === "invalid" || undefined}
          />
        </Field>
        <Button type="submit" size="lg" disabled={pending}>
          <LogIn aria-hidden />
          {t("login.submit")}
        </Button>
      </form>

      {demoAccounts.length > 0 && (
        <div className="grid gap-2 border-t border-dashed border-line pt-4">
          <p className="text-sm font-extrabold">{t("login.demoTitle")}</p>
          <p className="text-[13px] text-muted">{t("login.demoHint")}</p>
          <div className="flex flex-wrap gap-2">
            {demoAccounts.map((a) => (
              <button
                key={a.login}
                type="button"
                disabled={pending}
                onClick={() => fill(a)}
                className="cursor-pointer rounded-full transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                title={`${a.login} / ${a.password}`}
              >
                <Chip tone={a.role}>{a.name}</Chip>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
