"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { createClass, type FormResult } from "./actions";

export function CreateClassForm() {
  const t = useTranslations("teacher.classes");
  const [state, action, pending] = useActionState<FormResult, FormData>(createClass, undefined);
  return (
    <form action={action} className="grid gap-3">
      <h2 className="text-lg font-bold">{t("create")}</h2>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <Field id="class-name" label={t("name")} hint={t("nameHint")}>
          <Input id="class-name" name="name" required maxLength={20} placeholder="7«Ә»" />
        </Field>
        <Field id="class-grade" label={t("grade")}>
          <Select id="class-grade" name="grade" defaultValue="7">
            {[5, 6, 7, 8, 9, 10, 11].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm font-bold text-coral-700">
          {t(`errors.${state.error === "noSchool" ? "noSchool" : "invalid"}`)}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        <Plus aria-hidden />
        {t("createButton")}
      </Button>
    </form>
  );
}
