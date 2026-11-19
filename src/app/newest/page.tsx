import { Suspense } from "react";
import { DatasheetTable, SyntheticNote } from "@/components/datasheet-table";
import { PageHead, PageShell } from "@/components/page-shell";
import { OutOfRange, Pager, pageFromParam, pageOutOfRange } from "@/components/pager";
import { StoryList, StoryListSkeleton } from "@/components/story-list";
import { toRows } from "@/lib/rows";
import { CFG } from "@/lib/config";
import { formatCount } from "@/lib/format";
import { getNewestPage } from "@/services/posts";
import { getViewer, getViewerOpts } from "@/services/viewer";
import { getViewerFlags } from "@/services/flags";
import { getVotes } from "@/services/votes";

type Search = Promise<{ p?: string }>;

/** Strict reverse-chronological. No ranking, which the aside states rather than implying. */
export default function NewestPage({ searchParams }: { searchParams: Search }) {
  return (
    <PageShell rows="stories" nav="Newest" section="newest" aside={<NewestAside />}>
      <PageHead title="Newest" sub="Every submission, newest first. Not ranked." />
      <Suspense fallback={<StoryListSkeleton />}>
        <NewestList searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function NewestList({ searchParams }: { searchParams: Search }) {
  const [params, viewer, opts] = await Promise.all([searchParams, getViewer(), getViewerOpts()]);
  const page = pageFromParam(params.p);
  const newest = await getNewestPage(page, opts);

  if (pageOutOfRange(newest)) return <OutOfRange page={newest} basePath="/newest" />;

  const rows = toRows(newest.items, newest, (post) => ({ points: post.scoreRaw, post }));

  // This viewer's standing votes on the ids shown, so an already-upvoted row arrives with its glyph
  // filled. Separate from the listing read, which is identical for every viewer.
  const ids = rows.map((row) => row.post.id);
  const [voted, flagged] = await Promise.all([getVotes("post", ids), getViewerFlags("post", ids)]);

  return (
    <>
      <StoryList
        rows={rows}
        viewerName={opts.userId}
        canFlag={viewer?.canFlag ?? false}
        voted={new Set(voted.keys())}
        flagged={flagged}
      />
      <Pager page={newest} basePath="/newest" />
    </>
  );
}

async function NewestAside() {
  const opts = await getViewerOpts();

  return (
    <DatasheetTable
      number={1}
      title="About this list"
      rows={[
        ["Order", "Submission time, newest first"],
        ["Ranking", "None on this page"],
        ["Page size", formatCount(CFG.pageSize)],
        ["Dead stories", opts.showDead ? "Shown" : "Hidden"],
      ]}
      note={<SyntheticNote />}
    />
  );
}
