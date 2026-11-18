/**
 * Form fields as the design sets them: white ground, 1 px field border, 2 px radius, a petrol caret,
 * and a petrol halo on focus. An invalid field takes a red border on near-white with a red message
 * and a warning glyph beneath it.
 *
 * **The input is always preserved.** Every error state here renders around the value the person
 * typed, never instead of it — that is the debrief's requirement and the reason these are
 * uncontrolled fields with `defaultValue`.
 */
// The halo steps in with everything else. Visible focus is an a11y requirement (N5), so it is the
// one piece of motion here that must still arrive instantly under reduced motion — a transition
// rather than an animation, which the global reduced-motion rule collapses to 0.01 ms.
const BASE =
  "w-full rounded-hair border px-[10px] py-2 text-[15px] caret-petrol transition-shadow step-120 placeholder:text-meta focus:outline-none focus:shadow-[0_0_0_2px_rgba(0,100,110,.22)]";
const VALID = "border-field bg-white hover:border-field-hover focus:border-petrol";
const INVALID = "border-red bg-[#FFFBFA] focus:border-red";

export function Field({
  name,
  label,
  hint,
  error,
  counter,
  children,
}: {
  name: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  /** Shown right-aligned beside the label, e.g. "0 / 80". Turns red once over the limit. */
  counter?: { value: number; max: number };
  children: React.ReactNode;
}) {
  const over = counter ? counter.value > counter.max : false;

  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={name} className="text-[13.5px] font-semibold">
          {label}
        </label>
        {counter ? (
          <span className={`text-[12.5px] tabular-nums ${over ? "font-semibold text-red" : "text-meta"}`}>
            {counter.value} / {counter.max}
          </span>
        ) : null}
      </div>

      <div className="mt-[6px]">{children}</div>

      {error ? (
        <p className="mt-[6px] flex items-start gap-[6px] text-[13px] text-red">
          <span aria-hidden="true" className="mt-[2px] shrink-0">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 2 L15 14 H1 Z" strokeLinejoin="round" />
              <path d="M8 6.5 V9.5" strokeLinecap="round" />
              <circle cx="8" cy="11.6" r="0.7" fill="currentColor" stroke="none" />
            </svg>
          </span>
          {error}
        </p>
      ) : null}

      {hint && !error ? <p className="mt-[6px] text-[12.5px] text-meta">{hint}</p> : null}
    </div>
  );
}

export function textInputClass(invalid: boolean): string {
  return `${BASE} ${invalid ? INVALID : VALID}`;
}

/** The "or" rule between two mutually exclusive fields. */
export function OrDivider() {
  return (
    <div className="mt-5 flex items-center gap-4" aria-hidden="true">
      <span className="h-px flex-1 bg-rule-2" />
      <span className="text-[13px] text-meta">or</span>
      <span className="h-px flex-1 bg-rule-2" />
    </div>
  );
}

export function PrimaryButton({ children, ...rest }: React.ComponentProps<"button">) {
  return (
    <button
      {...rest}
      className="inline-flex h-9 items-center rounded-hair bg-ink px-4 text-[14px] font-semibold text-paper hover:bg-ink-hover disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink"
    >
      {children}
    </button>
  );
}
