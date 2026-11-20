"use client";

import { CityMap } from "./city-map";
import type { CityLevels } from "./engine/buildings";
import type { PlacedDecoration } from "./engine/decorations";

/** A student's city for teachers and parents: pan and zoom, no selection, no editing. */
export function ReadOnlyCity({
  levels,
  cityName,
  labels,
  decorations,
}: {
  levels: CityLevels;
  cityName: string;
  labels: { map: string; zoomIn: string; zoomOut: string; zoomReset: string };
  decorations?: PlacedDecoration[];
}) {
  return <CityMap levels={levels} cityName={cityName} labels={labels} decorations={decorations} />;
}
