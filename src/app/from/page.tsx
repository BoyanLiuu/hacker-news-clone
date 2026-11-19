import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHead, PageShell } from "@/components/page-shell";
import { OutOfRange, Pager, pageFromParam, pageOutOfRange } from "@/components/pager";
import { StoryList, StoryListSkeleton } from "@/components/story-list";
import { toRows } from "@/lib/rows";
import { registrableDomain } from "@/lib/domain";
import { getPostsByDomain } from "@/services/posts";
import { getViewer, getViewerOpts } from "@/services/viewer";
import { getViewerFlags } from "@/services/flags";
import { getVotes } from "@/services/votes";

type Search = Promise<{ site?: string; p?: string }>;

/**
 * Everything from one registrable domain. The site is normalised the same way it was derived on
 * insert, so blog.example.com and example.com land on one page rather than two.
 *
 * The page title comes from the query string, so the whole main column streams — the promise is
 * passed down and awaited inside the boundary rather than in the shell, which keeps the header
 * and footer flush before the list resolves.
 */
export default function FromPage({ searchParams }: { searchParams: Search }) {
  return (
    <PageShell rows="stories" nav="">
      <Suspense fallback={<StoryListSkeleton />}>
        <DomainColumn searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function DomainColumn({ searchParams }: { searchParams: Search }) {
  const [params, viewer, opts] = await Promise.all([searchParams, getViewer(), getViewerOpts()]);
  const site = normaliseSite(params.site);

  if (!site) {
    return (
      <>
        <PageHead title="From a site" />
        <EmptyState heading="No site given" action={{ href: "/", label: "Back to the front page" }}>
          Add a site to the address, as in <code className="rounded-hair bg-well px-1">/from?site=example.com</code>,
          or follow a domain link beside any story title.
        </EmptyState>
      </>
    );
  }

  const page = pageFromParam(params.p);
  const listing = await getPostsByDomain(site, page, opts);

  if (listing.total === 0) {
    return (
      <>
        <PageHead title={site} />
        <EmptyState heading={`Nothing from ${site} yet`} action={{ href: "/submit", label: "Submit a link" }}>
          When someone submits a link from this site it will be listed here, newest first. Sites are grouped
          by registrable domain, so blog.{site} and {site} share a page.
        </EmptyState>
      </>
    );
  }

  if (pageOutOfRange(listing)) {
    return (
      <>
        <PageHead title={site} />
        <OutOfRange page={listing} basePath="/from" query={{ site }} />
      </>
    );
  }

  const rows = toRows(listing.items, listing, (post) => ({ points: post.scoreRaw, post }));

  // This viewer's standing votes on the ids shown, so an already-upvoted row arrives with its glyph
  // filled. Separate from the listing read, which is identical for every viewer.
  const ids = rows.map((row) => row.post.id);
  const [voted, flagged] = await Promise.all([getVotes("post", ids), getViewerFlags("post", ids)]);

  return (
    <>
      <PageHead title={site} />
      <StoryList
        rows={rows}
        viewerName={opts.userId}
        canFlag={viewer?.canFlag ?? false}
        voted={new Set(voted.keys())}
        flagged={flagged}
      />
      <Pager page={listing} basePath="/from" query={{ site }} />
    </>
  );
}


/** Accepts a bare host or a full URL, and rejects anything that is not a domain. */
function normaliseSite(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return registrableDomain(trimmed.includes("//") ? trimmed : `https://${trimmed}`);
}
