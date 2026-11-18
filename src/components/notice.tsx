/**
 * A notice in one of three tones, each tied to a state rather than a mood — DESIGN.md's State
 * Colour Rule. Amber is stale, limited or rolled back; red is error, dead or destructive; tint is
 * informational. None of them appears without its matching state.
 */
export type NoticeTone = "info" | "amber" | "red";

const TONES: Record<NoticeTone, { box: string; icon: string }> = {
  info: { box: "border-tint-line bg-tint text-ink", icon: "text-petrol-ink" },
  amber: { box: "border-amber-line bg-amber-bg text-ink", icon: "text-amber" },
  red: { box: "border-red-line bg-red-bg text-ink", icon: "text-red" },
};

export function Notice({
  tone,
  children,
  action,
}: {
  tone: NoticeTone;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const style = TONES[tone];

  return (
    <div
      role={tone === "red" ? "alert" : "status"}
      className={`mt-4 flex items-start gap-3 rounded-hair border px-[14px] py-[10px] text-[14px] ${style.box}`}
    >
      <span aria-hidden="true" className={`mt-[2px] shrink-0 ${style.icon}`}>
        {tone === "info" ? <InfoIcon /> : <WarningIcon />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      {action ? <span className="shrink-0">{action}</span> : null}
    </div>
  );
}

/** Authored glyphs, 16px — the design has no icon library. */
function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2 L15 14 H1 Z" strokeLinejoin="round" />
      <path d="M8 6.5 V9.5" strokeLinecap="round" />
      <circle cx="8" cy="11.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 7.2 V11.2" strokeLinecap="round" />
      <circle cx="8" cy="4.9" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
