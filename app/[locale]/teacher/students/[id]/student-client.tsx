"use client";

import { Check, RotateCcw, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { assignPersonalTask, grantRetake, type StudentActionResult } from "../actions";

type TaskOption = { id: string; title: string };

export function RetakeForm({ studentId, tasks }: { studentId: string; tasks: TaskOption[] }) {
  const t = useTranslations("teacher.student");
  const [state, action, pending] = useActionState<StudentActionResult, FormData>(
    grantRetake.bind(null, studentId),
    undefined,
  );
  return (
    <form action={action} className="grid gap-2">
      <h2 className="text-lg font-bold">{t("retakeTitle")}</h2>
      <p className="text-sm text-muted">{t("retakeHint")}</p>
      <Select name="taskId" required defaultValue="" aria-label={t("task")}>
        <option value="" disabled>
          {t("task")}
        </option>
        {tasks.map((task) => (
          <option key={task.id} value={task.id}>
            {task.title}
          </option>
        ))}
      </Select>
      <label className="grid gap-1 text-xs font-bold text-muted sm:max-w-32">
        {t("extra")}
        <Input type="number" name="extra" min={1} max={5} defaultValue={1} className="min-h-10 py-2" />
      </label>
      {state?.error && <p className="text-sm font-bold text-coral-700">{t("error")}</p>}
      {state?.ok && !pending && (
        <p role="status" className="inline-flex items-center gap-1.5 text-sm font-bold text-grass-700">
          <Check className="size-4" aria-hidden />
          {t("retakeDone")}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending} className="justify-self-start">
        <RotateCcw aria-hidden />
        {t("retakeButton")}
      </Button>
    </form>
  );
}

export function PersonalTaskForm({ studentId, tasks }: { studentId: string; tasks: TaskOption[] }) {
  const t = useTranslations("teacher.student");
  const [state, action, pending] = useActionState<StudentActionResult, FormData>(
    assignPersonalTask.bind(null, studentId),
    undefined,
  );
  return (
    <form action={action} className="grid gap-2">
      <h2 className="text-lg font-bold">{t("personalTitle")}</h2>
      <Select name="taskId" required defaultValue="" aria-label={t("task")}>
        <option value="" disabled>
          {t("task")}
        </option>
        {tasks.map((task) => (
          <option key={task.id} value={task.id}>
            {task.title}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <label className="inline-flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="required" className="size-4 accent-(--color-primary)" />
          {t("required")}
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted">
          {t("deadline")}
          <Input type="date" name="deadline" className="min-h-10 py-1.5" />
        </label>
      </div>
      {state?.error && <p className="text-sm font-bold text-coral-700">{t("error")}</p>}
      {state?.ok && !pending && (
        <p role="status" className="inline-flex items-center gap-1.5 text-sm font-bold text-grass-700">
          <Check className="size-4" aria-hidden />
          {t("personalDone")}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending} className="justify-self-start">
        <UserPlus aria-hidden />
        {t("personalButton")}
      </Button>
    </form>
  );
}
