"use client";

import { FileText, Image as ImageIcon, Music, Trash2, Upload, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { addTextMaterial, assignTask, deleteMaterial, removeAssignment, type AssignResult } from "../actions";

type Assignment = {
  id: string;
  isRequired: boolean;
  deadline: string | null;
  label: string;
};

/** Assign to a class or a student (wireframe §4.2 step 5). */
export function AssignmentsPanel({
  taskId,
  grade,
  assignments,
  targets,
}: {
  taskId: string;
  /** Only classes of this grade (and their students) are offered — the server enforces it too. */
  grade: number;
  assignments: Assignment[];
  targets: { value: string; label: string; group: "class" | "student" }[];
}) {
  const t = useTranslations("teacher.assign");
  const [state, action, pending] = useActionState<AssignResult, FormData>(assignTask.bind(null, taskId), undefined);
  const [removing, start] = useTransition();
  return (
    <div className="grid gap-3">
      <div>
        <h2 className="text-lg font-bold">{t("title")}</h2>
        <p className="text-xs text-muted">{t("gradeHint", { n: grade })}</p>
      </div>
      {assignments.length === 0 ? (
        <p className="text-sm text-muted">{t("none")}</p>
      ) : (
        <ul className="grid gap-1.5 text-sm">
          {assignments.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-md bg-cream px-3 py-2">
              <span className="min-w-0 flex-1">
                <b>{a.label}</b>
                <span className="text-muted">
                  {" · "}
                  {a.isRequired ? t("required") : t("optional")}
                  {a.deadline && ` · ${t("until", { date: a.deadline })}`}
                </span>
              </span>
              <button
                type="button"
                disabled={removing}
                onClick={() => start(() => removeAssignment(a.id))}
                aria-label={t("remove")}
                className="grid size-8 cursor-pointer place-items-center rounded-full text-coral-700 hover:bg-coral-100"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {targets.length === 0 && <p className="text-sm font-bold text-sun-700">{t("noClassOfGrade", { n: grade })}</p>}
      <form action={action} className="grid gap-2 border-t border-dashed border-line pt-3">
        <Select name="target" required aria-label={t("target")} defaultValue="">
          <option value="" disabled>
            {t("target")}
          </option>
          <optgroup label={t("classes")}>
            {targets
              .filter((x) => x.group === "class")
              .map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
          </optgroup>
          <optgroup label={t("students")}>
            {targets
              .filter((x) => x.group === "student")
              .map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
          </optgroup>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <label className="inline-flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="required" defaultChecked className="size-4 accent-(--color-primary)" />
            {t("required")}
          </label>
          <label className="grid gap-1 text-xs font-bold text-muted">
            {t("deadline")}
            <Input type="date" name="deadline" className="min-h-10 py-1.5" />
          </label>
        </div>
        {state?.error && <p className="text-sm font-bold text-coral-700">{t(`errors.${state.error}`)}</p>}
        <Button type="submit" size="sm" disabled={pending} className="justify-self-start">
          {t("assign")}
        </Button>
      </form>
    </div>
  );
}

type Material = { id: string; kind: "TEXT" | "IMAGE" | "AUDIO" | "VIDEO"; title: string; sizeBytes: number | null };
const ICON = { TEXT: FileText, IMAGE: ImageIcon, AUDIO: Music, VIDEO: Video } as const;

/** Text, image, audio and video materials (spec §2.2). */
export function MaterialsPanel({ taskId, materials }: { taskId: string; materials: Material[] }) {
  const t = useTranslations("teacher.materials");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [textState, textAction, textPending] = useActionState<AssignResult, FormData>(
    addTextMaterial.bind(null, taskId),
    undefined,
  );
  const [removing, start] = useTransition();

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(false);
    const body = new FormData();
    body.append("file", file);
    body.append("title", title);
    const res = await fetch(`/api/tasks/${taskId}/materials`, { method: "POST", body }).catch(() => null);
    setUploading(false);
    if (!res?.ok) return setUploadError(true);
    setTitle("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  };

  return (
    <div className="grid gap-3">
      <h2 className="text-lg font-bold">{t("title")}</h2>
      {materials.length > 0 && (
        <ul className="grid gap-1.5 text-sm">
          {materials.map((m) => {
            const Icon = ICON[m.kind];
            return (
              <li key={m.id} className="flex items-center gap-2 rounded-md bg-cream px-3 py-2">
                <Icon className="size-4 shrink-0 text-primary-edge" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-bold">{m.title}</span>
                {m.sizeBytes != null && <span className="text-xs text-muted">{Math.ceil(m.sizeBytes / 1024)} KB</span>}
                <button
                  type="button"
                  disabled={removing}
                  onClick={() => start(() => deleteMaterial(m.id))}
                  aria-label={t("remove")}
                  className="grid size-8 cursor-pointer place-items-center rounded-full text-coral-700 hover:bg-coral-100"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="grid gap-2 border-t border-dashed border-line pt-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("fileTitle")}
          aria-label={t("fileTitle")}
          className="min-h-10 py-2"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,audio/*,video/mp4,video/webm"
          aria-label={t("file")}
          className="text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-sky-100 file:px-3 file:py-2 file:font-bold file:text-sky-700"
        />
        <p className="text-xs text-muted">{t("fileHint")}</p>
        {uploadError && <p className="text-sm font-bold text-coral-700">{t("uploadError")}</p>}
        <Button size="sm" variant="ghost" onClick={upload} disabled={uploading} className="justify-self-start">
          <Upload aria-hidden />
          {uploading ? t("uploading") : t("upload")}
        </Button>
      </div>
      <form
        action={textAction}
        className="grid gap-2 border-t border-dashed border-line pt-3"
        key={String(textState?.ok)}
      >
        <Input
          name="title"
          placeholder={t("textTitle")}
          aria-label={t("textTitle")}
          className="min-h-10 py-2"
          maxLength={160}
        />
        <Textarea
          name="body"
          placeholder={t("textBody")}
          aria-label={t("textBody")}
          className="min-h-20"
          maxLength={10000}
        />
        {textState?.error && <p className="text-sm font-bold text-coral-700">{t("textError")}</p>}
        <Button type="submit" size="sm" variant="ghost" disabled={textPending} className="justify-self-start">
          <FileText aria-hidden />
          {t("addText")}
        </Button>
      </form>
    </div>
  );
}
