import { notFound } from "next/navigation";

// Catches unknown paths inside a locale so the localized not-found page renders.
export default function CatchAllPage() {
  notFound();
}
