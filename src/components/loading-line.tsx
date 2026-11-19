/**
 * The one-line Suspense fallback, for pages whose main column is a thread or a form rather than a
 * list. Lists use `StoryListSkeleton`, which can mimic the grid it is standing in for; a reply box
 * or a comment tree has no shape worth faking, and bars drawn where a form will land read as a
 * promise about a layout that then arrives different.
 *
 * `role="status"` because the text is inserted after the page is announced. Without it a screen
 * reader reads the shell, falls silent, and the swap passes unmentioned.
 */
export function LoadingLine({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="mt-4 type-meta text-meta">
      {children}
    </p>
  );
}
