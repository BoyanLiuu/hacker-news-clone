/**
 * The reply box. It renders and the browser validates it, but it cannot persist until M12 brings
 * `createComment` — the service throws `NotImplementedInStaticPhase` by design, so phase 1 is
 * honest about what works.
 *
 * A plain form with no `onSubmit`, so it degrades to a normal POST once the action exists.
 *
 * `targetId` is submitted as a hidden field, and that is load-bearing today. With no `action`, a
 * submit is a GET to the current path — which replaces the query string, drops `id`, and lands on
 * a 404. Carrying the id means an early submit returns to the page it was typed on. M12's action
 * needs the same field.
 *
 * `elementId` is a prop rather than a constant because M11 puts an inline reply box on every
 * comment: two forms sharing one element id would point both labels at the first textarea.
 */
export function ReplyForm({
  targetId,
  label = "Add to the discussion",
  submit = "Add comment",
  elementId = "reply-text",
}: {
  /** The post or parent comment this reply belongs to. */
  targetId: number;
  label?: string;
  submit?: string;
  elementId?: string;
}) {
  return (
    <form className="mt-4 max-w-[795px]">
      <input type="hidden" name="id" value={targetId} />

      <label className="sr-only" htmlFor={elementId}>
        {label}
      </label>
      <textarea
        id={elementId}
        name="text"
        rows={4}
        required
        maxLength={10_000}
        placeholder={label}
        className="w-full rounded-hair border border-field bg-white px-[10px] py-2 text-[15px] caret-petrol placeholder:text-meta hover:border-field-hover focus:border-petrol focus:shadow-[0_0_0_2px_rgba(0,100,110,.22)] focus:outline-none"
      />

      <button
        type="submit"
        className="mt-3 inline-flex h-9 items-center rounded-hair bg-ink px-4 text-[14px] font-semibold text-paper hover:bg-ink-hover"
      >
        {submit}
      </button>

      {/* States what the formatter actually supports, including that HTML is not markup. */}
      <p className="mt-3 max-w-[70ch] text-[12.5px] leading-[1.5] text-meta">
        Blank line for a new paragraph · <code className="font-mono">*italics*</code> ·{" "}
        <code className="font-mono">`code`</code> · indent two spaces for a block · links work · HTML shows
        as text
      </p>
    </form>
  );
}
