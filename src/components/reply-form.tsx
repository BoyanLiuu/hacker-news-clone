/**
 * The reply box. It renders and the browser validates it, but it cannot persist until M11 brings
 * the server action — the service throws `NotImplementedInStaticPhase` by design, so phase 1 is
 * honest about what works.
 *
 * A plain form with no `onSubmit`, so it degrades to a normal POST once the action exists.
 */
export function ReplyForm({ label = "Add to the discussion", submit = "Add comment" }: { label?: string; submit?: string }) {
  return (
    <form className="mt-4 max-w-[795px]">
      <label className="sr-only" htmlFor="reply-text">
        {label}
      </label>
      <textarea
        id="reply-text"
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
