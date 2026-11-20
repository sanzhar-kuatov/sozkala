import {
  Castle,
  Drama,
  Feather,
  GitCommitHorizontal,
  Landmark,
  Library,
  Palette,
  SpellCheck,
  type LucideIcon,
} from "lucide-react";
import type { BuildingKey } from "@/lib/domain/buildings";

/** lucide icon per building (matches the `icon` names in lib/domain/buildings.ts). */
export const BUILDING_ICONS: Record<BuildingKey, LucideIcon> = {
  grammar: SpellCheck,
  bridge: GitCommitHorizontal,
  library: Library,
  theatre: Drama,
  tower: Castle,
  academy: Palette,
  park: Feather,
  townhall: Landmark,
};

/** Score/level colour token (spec §4 scale): 0 grey … 5 violet. */
export const levelColor = (level: number) => `var(--score-${Math.max(0, Math.min(5, level))})`;
