import { getFormatter, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import type { LearningHistory } from "@/lib/student/history";
import { LineChart } from "./line-chart";
import { TableView } from "./table-view";

/** Personal progress line (graded scores in time order); shared by the student history and parent pages. */
export async function ProgressCard({ series }: { series: LearningHistory["series"] }) {
  const t = await getTranslations("history");
  const format = await getFormatter();
  const day = (d: Date) => format.dateTime(d, { day: "2-digit", month: "2-digit" });
  return (
    <Card className="grid grid-cols-[minmax(0,1fr)] content-start gap-3">
      <div>
        <h2 className="text-lg font-bold">{t("chart")}</h2>
        <p className="text-sm text-muted">{t("chartHint")}</p>
      </div>
      {series.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <>
          <LineChart
            label={t("chart")}
            yMax={10}
            yTicks={[0, 5, 10]}
            points={series.map((p) => ({ x: day(p.at), value: p.score, detail: p.title }))}
          />
          <TableView
            summary={t("asTable")}
            head={[t("date"), t("task"), t("score")]}
            rows={series.map((p) => [day(p.at), p.title, p.score])}
          />
        </>
      )}
    </Card>
  );
}
