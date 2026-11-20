import { FileText, Image as ImageIcon, Music, Video } from "lucide-react";
import type { TaskMaterial } from "@/lib/student/attempts";

const ICON = { TEXT: FileText, IMAGE: ImageIcon, AUDIO: Music, VIDEO: Video } as const;

/** Task materials (spec §2.2: text, image, audio, video) shown above the questions. */
export function MaterialsList({ materials }: { materials: TaskMaterial[] }) {
  if (materials.length === 0) return null;
  return (
    <div className="grid gap-3">
      {materials.map((m) => {
        const Icon = ICON[m.kind];
        const src = m.filePath ? `/api/files/${m.filePath}` : null;
        return (
          <figure key={m.id} className="grid gap-2 rounded-lg border border-line bg-surface p-4">
            <figcaption className="flex items-center gap-2 text-sm font-bold">
              <Icon className="size-4 text-primary-edge" aria-hidden />
              {m.title}
            </figcaption>
            {m.kind === "TEXT" && <p className="text-lg leading-relaxed whitespace-pre-line">{m.body}</p>}
            {/* eslint-disable-next-line @next/next/no-img-element -- private, permission-checked file */}
            {m.kind === "IMAGE" && src && <img src={src} alt={m.title} className="max-h-[420px] w-auto rounded-md" />}
            {m.kind === "AUDIO" && src && <audio controls src={src} className="w-full" />}
            {m.kind === "VIDEO" && src && <video controls src={src} className="w-full rounded-md" />}
          </figure>
        );
      })}
    </div>
  );
}
