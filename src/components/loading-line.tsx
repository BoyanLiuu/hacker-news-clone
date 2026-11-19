/**
 * The one-line Suspense fallback, for a form or a queue — something with no shape worth faking.
 * Lists get `StoryListSkeleton` and threads `ThreadSkeleton`, which can stand on the real grid.
 *
 * `role="status"` so the swap is announced; it arrives after the page has been read out.
 */
export function LoadingLine({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="mt-4 type-meta text-meta">
      {children}
    </p>
  );
}
