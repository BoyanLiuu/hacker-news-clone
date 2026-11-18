import Link from "next/link";

/**
 * The datasheet table: a numbered caption in meta weight before a bold title, a head band, pale
 * row rules. Key column in ink-2, value column right-aligned — DESIGN.md §Datasheet Tables.
 *
 * Every listing carries one as its aside, saying how the list is ordered, so the ordering is a
 * stated fact rather than something the reader has to infer.
 */
export function DatasheetTable({
  number,
  title,
  rows,
  note,
}: {
  number: number;
  title: string;
  rows: ReadonlyArray<readonly [string, React.ReactNode]>;
  note?: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="type-section">
        <span className="pr-2 font-medium text-meta">Table {number}</span>
        {title}
      </h2>

      <table className="mt-2 w-full border-collapse text-[13px] rule-open">
        <tbody>
          {rows.map(([label, value], i) => (
            <tr key={label} className={i === rows.length - 1 ? "rule-close" : "rule-divide"}>
              <th scope="row" className="px-2 py-[7px] text-left font-normal text-ink-2">
                {label}
              </th>
              <td className="px-2 py-[7px] text-right tabular-nums">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {note ? <p className="mt-3 text-[12px] leading-[1.5] text-meta">{note}</p> : null}
    </section>
  );
}

/** The note every listing's aside ends with: the data is synthetic, and where the rules live. */
export function SyntheticNote() {
  return (
    <>
      Measured on synthetic sample data.{" "}
      <Link href="/rank-debug" className="text-petrol-ink underline underline-offset-2">
        Ranking details
      </Link>
    </>
  );
}
