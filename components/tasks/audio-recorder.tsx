"use client";

import { CircleCheck, Mic, RotateCcw, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Question } from "./inputs";

type Props = {
  question: Question;
  answer: Record<string, unknown> | undefined;
  onChange: (a: unknown) => void;
  attemptId: string;
};

const PREFERRED = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Record → listen → re-record; the file is uploaded as soon as recording stops (spec §5 audio task). */
export function AudioRecorder({ question, answer, onChange, attemptId }: Props) {
  const t = useTranslations("task.in");
  const maxSeconds = (question.maxSeconds as number | undefined) ?? 180;
  const [state, setState] = useState<"idle" | "recording" | "uploading" | "error">("idle");
  const [error, setError] = useState<"mic" | "upload" | "unsupported" | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);
  const file = answer?.file as string | undefined;

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((tr) => tr.stop());
    },
    [],
  );

  const start = async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("unsupported");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("mic");
      return;
    }
    const mimeType = PREFERRED.find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop());
      if (timer.current) clearInterval(timer.current);
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      setLocalUrl(URL.createObjectURL(blob));
      setState("uploading");
      try {
        const body = new FormData();
        body.append("file", new File([blob], "answer", { type: blob.type.split(";")[0] }));
        const res = await fetch(`/api/attempts/${attemptId}/audio`, { method: "POST", body });
        if (!res.ok) throw new Error(String(res.status));
        const { file: key } = (await res.json()) as { file: string };
        onChange({ file: key, durationSec: Math.round(secondsRef.current) });
        setState("idle");
      } catch {
        setError("upload");
        setState("error");
      }
    };
    recorder.current = rec;
    rec.start();
    setElapsed(0);
    secondsRef.current = 0;
    setState("recording");
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      secondsRef.current = s;
      setElapsed(s);
      if (s >= maxSeconds) rec.stop();
    }, 250);
  };

  const src = localUrl ?? (file ? `/api/files/${file}` : null);

  return (
    <div className="grid gap-4">
      {typeof question.readText === "string" && (
        <div>
          <p className="mb-1.5 text-sm font-bold text-muted">{t("readAloud")}</p>
          <blockquote className="rounded-md border-l-4 border-primary bg-sky-50 p-4 text-xl leading-relaxed whitespace-pre-line">
            {question.readText}
          </blockquote>
        </div>
      )}
      <p className="text-sm text-muted">{t("maxLen", { sec: maxSeconds })}</p>

      <div className="flex flex-wrap items-center gap-3">
        {state === "recording" ? (
          <Button variant="danger" size="lg" onClick={() => recorder.current?.stop()}>
            <Square aria-hidden />
            {t("stop")}
          </Button>
        ) : (
          <Button variant={file ? "ghost" : "primary"} size="lg" onClick={start} disabled={state === "uploading"}>
            {file ? <RotateCcw aria-hidden /> : <Mic aria-hidden />}
            {file ? t("rerecord") : t("record")}
          </Button>
        )}
        <span role="status" className="text-sm font-bold">
          {state === "recording" && (
            <span className="inline-flex items-center gap-2 text-coral-700">
              <span className="size-2.5 animate-pulse rounded-full bg-coral-500" aria-hidden />
              {t("recording", { time: fmt(elapsed) })}
            </span>
          )}
          {state === "uploading" && t("uploading")}
          {state === "idle" && file && (
            <span className="inline-flex items-center gap-1.5 text-grass-700">
              <CircleCheck className="size-4" aria-hidden />
              {t("uploaded")}
            </span>
          )}
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-coral-100 px-3 py-2.5 text-sm font-bold text-coral-700">
          {error === "mic" ? t("micError") : error === "upload" ? t("uploadError") : t("unsupported")}
        </p>
      )}

      {src && state !== "recording" && <audio controls src={src} className="w-full" />}
    </div>
  );
}
