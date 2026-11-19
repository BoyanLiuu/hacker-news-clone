import Link from "next/link";
import { Suspense } from "react";
import { getViewer } from "@/services/viewer";
import { KeyboardHint } from "./keyboard-hint";

const LINK = "text-meta underline decoration-rule underline-offset-[3px]";

/**
 * `rows` says what the page under this footer can be navigated with, and the hint names only those
 * keys. The comps show `j k move · u vote · x collapse · ?`, which is the thread's set — on a
 * listing there is nothing to collapse, and advertising a key that does nothing is worse than
 * advertising none. Pages with no rows at all get no hint.
 */
export function SiteFooter({ rows }: { rows?: "comments" | "stories" }) {
  return (
    <footer className="mt-auto border-t border-rule pt-4 pb-[72px]">
      <div className="mx-auto flex max-w-wrap flex-wrap items-center gap-x-6 gap-y-2 px-4 type-meta text-meta sm:px-8">
        <span>Tally</span>
        <Link href="/rank-debug" className={LINK}>
          Ranking details
        </Link>
        <Link href="/settings" className={LINK}>
          Settings
        </Link>
        {/* Streamed on its own so one viewer read cannot hold up the footer rule. */}
        <Suspense fallback={null}>
          <ModerationLink />
        </Suspense>
        <span>Stories, people and comments here are synthetic sample data.</span>
        {rows ? <KeyboardHint rows={rows} /> : null}
      </div>
    </footer>
  );
}

/** The queue is reachable from every page for the people who work it, and invisible to everyone else. */
async function ModerationLink() {
  const viewer = await getViewer();
  if (!viewer?.user.isModerator) return null;

  return (
    <Link href="/admin/flagged" className={LINK}>
      Moderation
    </Link>
  );
}
