import Link from "next/link";
import { Suspense } from "react";
import { getViewer } from "@/services/viewer";

const LINK = "text-meta underline decoration-rule underline-offset-[3px]";

export function SiteFooter() {
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
