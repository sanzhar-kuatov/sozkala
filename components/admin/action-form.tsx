"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useActionState } from "react";
import { CredentialsCard } from "@/components/teacher/credentials-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminResult } from "@/app/[locale]/admin/actions";

/**
 * Admin form shell: server action + error message (admin.errors.*), a "saved"
 * status, and one-time credentials when the action created a password.
 */
export function ActionForm({
  action,
  children,
  submit,
  variant = "primary",
  size = "md",
  className,
  confirm,
}: {
  action: (prev: AdminResult, fd: FormData) => Promise<AdminResult>;
  children?: ReactNode;
  submit: ReactNode;
  variant?: "primary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md";
  className?: string;
  /** Asks before submitting (destructive actions). */
  confirm?: string;
}) {
  const t = useTranslations("admin");
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className={cn("grid gap-3", className)}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state?.error && (
        <p role="alert" className="rounded-md bg-coral-100 px-3 py-2 text-sm font-bold text-coral-700">
          {t(`errors.${state.error}` as "errors.invalid")}
        </p>
      )}
      {state?.created && <CredentialsCard {...state.created} />}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {state?.ok && !pending && (
          <span role="status" className="inline-flex items-center gap-1.5 text-sm font-bold text-grass-700">
            <Check className="size-4" aria-hidden />
            {t("saved")}
          </span>
        )}
        <Button type="submit" variant={variant} size={size} disabled={pending}>
          {submit}
        </Button>
      </div>
    </form>
  );
}
