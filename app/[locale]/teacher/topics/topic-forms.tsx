"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { BUILDINGS } from "@/lib/domain/buildings";
import { createTopic, deleteTopic, updateTopic, type TopicResult } from "./actions";

function TopicFields({ title = "", building = "", idPrefix }: { title?: string; building?: string; idPrefix: string }) {
  const t = useTranslations("teacher.topics");
  const locale = useLocale() as "kk" | "ru";
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
      <Input
        name="title"
        defaultValue={title}
        required
        maxLength={120}
        placeholder={t("titlePlaceholder")}
        aria-label={t("titleLabel")}
        id={`${idPrefix}-title`}
      />
      <Select name="building" defaultValue={building} aria-label={t("building")}>
        <option value="">{t("noBuilding")}</option>
        {BUILDINGS.map((b) => (
          <option key={b.key} value={b.key}>
            {b.name[locale]}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function CreateTopicForm() {
  const t = useTranslations("teacher.topics");
  const [state, action, pending] = useActionState<TopicResult, FormData>(createTopic, undefined);
  return (
    <form action={action} className="grid gap-2" key={state?.at ?? "new"}>
      <h2 className="text-lg font-bold">{t("create")}</h2>
      <TopicFields idPrefix="new" />
      {state?.error && <p className="text-sm font-bold text-coral-700">{t("invalid")}</p>}
      <Button type="submit" disabled={pending} className="justify-self-start">
        <Plus aria-hidden />
        {t("add")}
      </Button>
    </form>
  );
}

export function TopicRow({
  id,
  title,
  building,
  taskCount,
}: {
  id: string;
  title: string;
  building: string;
  taskCount: number;
}) {
  const t = useTranslations("teacher.topics");
  const locale = useLocale() as "kk" | "ru";
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<TopicResult, FormData>(async (prev, fd) => {
    const res = await updateTopic(id, prev, fd);
    if (res?.ok) setEditing(false);
    return res;
  }, undefined);
  const [deleting, start] = useTransition();

  if (editing) {
    return (
      <form action={action} className="grid gap-2 rounded-md border border-line bg-surface p-3">
        <TopicFields title={title} building={building} idPrefix={id} />
        {state?.error && <p className="text-sm font-bold text-coral-700">{t("invalid")}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {t("save")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-surface p-3">
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        <p className="text-sm text-muted">
          {building ? BUILDINGS.find((b) => b.key === building)?.name[locale] : t("noBuilding")} ·{" "}
          {t("tasks", { count: taskCount })}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={t("edit")}
        className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-cream"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        disabled={deleting}
        onClick={() => confirm(t("deleteConfirm", { title })) && start(() => deleteTopic(id))}
        aria-label={t("delete")}
        className="grid size-9 cursor-pointer place-items-center rounded-full text-coral-700 hover:bg-coral-100"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  );
}
