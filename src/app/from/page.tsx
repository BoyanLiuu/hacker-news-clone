import { connection } from "next/server";
import { Suspense } from "react";
import { DatasheetTable, SyntheticNote } from "@/components/datasheet-table";
import { EmptyState } from "@/components/empty-state";
import { PageHead, PageShell } from "@/components/page-shell";
import { OutOfRange, Pager, pageFromParam, pageOutOfRange } from "@/components/pager";
import { StoryList, StoryListSkeleton } from "@/components/story-list";
import { toRows } from "@/components/story-row";
import { registrableDomain } from "@/lib/domain";
import { getPostsByDomain } from "@/services/posts";
import { getViewerOpts } from "@/services/viewer";

type Search = Promise<{ site?: string; p?: string }>;

/**
 * Everything from one registrable domain. The site is normalised the same way it was derived on
 * insert, so blog.example.com and example.com land on one page rather than two.
 *
 * The page title comes from the query string, so the whole main column streams — the promise is
 * passed down and awaited inside the boundary rather than in the shell, which keeps the header
 * and footer prerenderable.
 */
export default function FromPage({ searchParams }: { searchParams: Search }) {
  return (
    <PageShell
      nav=""
      section={searchParams.then((p) => {
        const site = normaliseSite(p.site);
        return site ? `from · ${site}` : "from";
      })}
      aside={<FromAside />}
    >
      <Suspense fallback={<StoryListSkeleton rows={6} />}>
        <DomainColumn searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function DomainColumn({ searchParams }: { searchParams: Search }) {
  await connection();

  const [params, opts] = await Promise.all([searchParams, getViewerOpts()]);
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

  return (
    <>
      <PageHead title={site} />
      <StoryList rows={rows} viewerName={opts.userId} />
      <Pager page={listing} basePath="/from" query={{ site }} />
    </>
  );
}

function FromAside() {
  return (
    <DatasheetTable
      number={1}
      title="About this list"
      rows={[
        ["Grouped by", "Registrable domain"],
        ["Order", "Newest first"],
        ["Includes", "Links only; text posts have no site"],
      ]}
      note={<SyntheticNote />}
    />
  );
}

/** Accepts a bare host or a full URL, and rejects anything that is not a domain. */
function normaliseSite(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return registrableDomain(trimmed.includes("//") ? trimmed : `https://${trimmed}`);
}
