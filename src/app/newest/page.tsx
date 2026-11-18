import { Suspense } from "react";
import { DatasheetTable, SyntheticNote } from "@/components/datasheet-table";
import { PageHead, PageShell } from "@/components/page-shell";
import { OutOfRange, Pager, pageFromParam, pageOutOfRange } from "@/components/pager";
import { StoryList, StoryListSkeleton } from "@/components/story-list";
import { toRows } from "@/components/story-row";
import { CFG } from "@/lib/config";
import { formatCount } from "@/lib/format";
import { getNewestPage } from "@/services/posts";
import { getViewer, getViewerOpts } from "@/services/viewer";

type Search = Promise<{ p?: string }>;

/** Strict reverse-chronological. No ranking, which the aside states rather than implying. */
export default function NewestPage({ searchParams }: { searchParams: Search }) {
  return (
    <PageShell nav="Newest" section="newest" aside={<NewestAside />}>
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

  return (
    <>
      <StoryList rows={rows} viewerName={opts.userId} canFlag={viewer?.canFlag ?? false} />
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
