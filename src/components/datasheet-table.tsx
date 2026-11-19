
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
  /** Omit both to get a plain facts table — the profile's key/value block has no caption. */
  number?: number;
  title?: string;
  rows: ReadonlyArray<readonly [React.ReactNode, React.ReactNode]>;
  note?: React.ReactNode;
}) {
  return (
    <section>
      {title ? (
        <h2 className="type-section">
          {number ? <span className="pr-2 font-medium text-meta">Table {number}</span> : null}
          {title}
        </h2>
      ) : null}

      {/* `table-fixed`, not auto: the thread-contents table puts a truncated comment preview in the
          row header, and in an auto-layout table a cell sizes to its content — so `truncate` never
          truncated and the table forced the page 58 px wider than a 375 px viewport. Fixed layout
          divides the available width and lets the truncation do its job. The value column is given
          a width so the numbers stay in a column rather than splitting the space evenly. */}
      <table
        className={`${title ? "mt-2" : ""} w-full table-fixed border-collapse text-[13px] rule-open`}
      >
        <tbody>
          {rows.map(([label, value], i) => (
            <tr key={i} className={i === rows.length - 1 ? "rule-close" : "rule-divide"}>
              <th scope="row" className="truncate px-2 py-[7px] text-left font-normal text-ink-2">
                {label}
              </th>
              <td className="w-[88px] px-2 py-[7px] text-right tabular-nums">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {note ? <p className="mt-3 text-[12px] leading-[1.5] text-meta">{note}</p> : null}
    </section>
  );
}

