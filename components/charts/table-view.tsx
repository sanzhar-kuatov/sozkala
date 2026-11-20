/** "Show as table" — every chart's values in an accessible table (dataviz rule: a table view exists). */
export function TableView({ summary, head, rows }: { summary: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-bold text-primary-edge">{summary}</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h} scope="col" className="border-b border-line px-2 py-1.5 text-xs font-bold text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="odd:bg-paper">
                {r.map((c, j) => (
                  <td key={j} className={`px-2 py-1.5 ${j > 0 ? "tabular-nums" : ""}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
