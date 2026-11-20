"use client";

import { Check, Copy, KeyRound, RefreshCw, UserMinus, UserPlus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { CredentialsCard } from "@/components/teacher/credentials-card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  addStudent,
  linkParent,
  regenerateInvite,
  removeStudent,
  resetStudentPassword,
  unlinkParent,
  type Credentials,
  type FormResult,
} from "../actions";

/** Invite code + join link with copy and regenerate. */
export function InviteCard({ classId, code, link }: { classId: string; code: string; link: string }) {
  const t = useTranslations("teacher.classes");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2">
      <p className="text-sm font-bold text-muted">{t("invite")}</p>
      <p className="font-mono text-3xl font-extrabold tracking-[0.15em]">{code}</p>
      <p className="text-sm break-all text-muted">{link}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await navigator.clipboard?.writeText(link).catch(() => {});
            setCopied(true);
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? t("copied") : t("copyLink")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (confirm(t("regenerateConfirm"))) start(() => regenerateInvite(classId));
          }}
        >
          <RefreshCw aria-hidden />
          {t("regenerate")}
        </Button>
      </div>
    </div>
  );
}

export function AddStudentForm({ classId }: { classId: string }) {
  const t = useTranslations("teacher.classes");
  const [state, action, pending] = useActionState<FormResult, FormData>(addStudent.bind(null, classId), undefined);
  return (
    <div className="grid gap-3">
      <form action={action} className="grid gap-3" key={state?.created?.login}>
        <h2 className="text-lg font-bold">{t("addStudent")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="s-first" label={t("firstName")}>
            <Input id="s-first" name="firstName" required maxLength={50} />
          </Field>
          <Field id="s-last" label={t("lastName")}>
            <Input id="s-last" name="lastName" required maxLength={50} />
          </Field>
        </div>
        {state?.error && <p className="text-sm font-bold text-coral-700">{t("errors.invalid")}</p>}
        <Button type="submit" disabled={pending}>
          <UserPlus aria-hidden />
          {t("addStudentButton")}
        </Button>
      </form>
      {state?.created && <CredentialsCard {...state.created} />}
    </div>
  );
}

/** Row actions: reset password, link parent, remove from class. */
export function StudentActions({
  classId,
  student,
}: {
  classId: string;
  student: { id: string; firstName: string; lastName: string; parents: { id: string; name: string; login: string }[] };
}) {
  const t = useTranslations("teacher.classes");
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [pending, start] = useTransition();
  const [parentState, parentAction, parentPending] = useActionState<FormResult, FormData>(
    linkParent.bind(null, student.id),
    undefined,
  );

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (confirm(t("resetConfirm", { name: `${student.firstName} ${student.lastName}` })))
              start(async () => setCreds(await resetStudentPassword(student.id)));
          }}
        >
          <KeyRound aria-hidden />
          {t("resetPassword")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (confirm(t("removeConfirm", { name: `${student.firstName} ${student.lastName}` })))
              start(() => removeStudent(classId, student.id));
          }}
        >
          <UserMinus aria-hidden />
          {t("remove")}
        </Button>
      </div>
      {creds && <CredentialsCard {...creds} />}

      <details className="rounded-md bg-cream p-3 text-sm">
        <summary className="flex cursor-pointer items-center gap-1.5 font-bold">
          <Users className="size-4" aria-hidden />
          {t("parents")} ({student.parents.length})
        </summary>
        <ul className="mt-2 grid gap-1">
          {student.parents.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="font-bold">{p.name}</span>
              <span className="font-mono text-muted">{p.login}</span>
              <button
                type="button"
                className="ml-auto cursor-pointer text-xs font-bold text-coral-700"
                onClick={() => start(() => unlinkParent(student.id, p.id))}
              >
                {t("unlink")}
              </button>
            </li>
          ))}
        </ul>
        <form
          action={parentAction}
          className="mt-3 grid gap-2"
          key={parentState?.created?.login ?? String(parentState?.ok)}
        >
          <p className="font-bold">{t("addParent")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              name="firstName"
              placeholder={t("firstName")}
              aria-label={t("parentFirstName")}
              maxLength={50}
              className="min-h-10 py-2"
            />
            <Input
              name="lastName"
              placeholder={t("lastName")}
              aria-label={t("parentLastName")}
              maxLength={50}
              className="min-h-10 py-2"
            />
          </div>
          <p className="text-xs text-muted">{t("orExisting")}</p>
          <Input
            name="parentLogin"
            placeholder={t("parentLogin")}
            aria-label={t("parentLogin")}
            className="min-h-10 py-2"
          />
          {parentState?.error && (
            <p className="font-bold text-coral-700">
              {t(parentState.error === "parentNotFound" ? "errors.parentNotFound" : "errors.invalid")}
            </p>
          )}
          <Button type="submit" size="sm" disabled={parentPending} className="justify-self-start">
            {t("addParentButton")}
          </Button>
        </form>
        {parentState?.created && (
          <div className="mt-2">
            <CredentialsCard {...parentState.created} />
          </div>
        )}
      </details>
    </div>
  );
}
