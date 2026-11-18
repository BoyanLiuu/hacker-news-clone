import Link from "next/link";

/**
 * An empty list explains why it is empty and offers the one action that would fill it. The design
 * gives it a section head, body copy at reading width, and a primary button — ux-30-empty-site.
 */
export function EmptyState({
  heading,
  children,
  action,
}: {
  heading: string;
  children: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mt-10 max-w-[68ch]">
      <h2 className="type-section">{heading}</h2>
      <p className="mt-2 type-reading text-ink-2">{children}</p>
      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex h-9 items-center rounded-hair bg-ink px-4 text-[14px] font-semibold text-paper hover:bg-ink-hover"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
