"use client";

import { Play, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { startTask } from "./actions";

type State = Awaited<ReturnType<typeof startTask>> | undefined;

export function StartButton({ taskId, retake }: { taskId: string; retake: boolean }) {
  const t = useTranslations("task");
  const [state, action, pending] = useActionState<State, FormData>(() => startTask(taskId), undefined);
  return (
    <form action={action} className="grid gap-2">
      <Button type="submit" size="lg" variant="accent" disabled={pending}>
        {retake ? <RotateCcw aria-hidden /> : <Play aria-hidden />}
        {retake ? t("retake") : t("start")}
      </Button>
      {state?.error && (
        <p role="alert" className="text-sm font-bold text-coral-700">
          {t(`blocked.${state.error}`)}
        </p>
      )}
    </form>
  );
}
