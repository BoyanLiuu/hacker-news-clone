import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CommentBody } from "@/components/comment-body";
import { DatasheetTable } from "@/components/datasheet-table";
import { PageHead, PageShell } from "@/components/page-shell";
import { StoryList } from "@/components/story-list";
import { toRows } from "@/lib/rows";
import { Tabs } from "@/components/tabs";
import { formatAgeLong, formatCount } from "@/lib/format";
import { getCommentsByAuthor } from "@/services/comments";
import { getPostsByAuthor } from "@/services/posts";
import { getUserByName } from "@/services/users";
import { getViewer, getViewerOpts } from "@/services/viewer";
import Link from "next/link";

type Params = Promise<{ username: string }>;
type Search = Promise<{ tab?: string }>;

/** A profile is a record, not a stage: karma, when they joined, about, and what they wrote. */
/** Validated before streaming, so an unknown name answers 404 rather than 200 — see item/page.tsx. */
/** Validated in the page body so the status is a real 404 — see item/page.tsx. */
export default async function UserPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  if (!(await getUserByName((await params).username))) notFound();

  return (
    <PageShell rows="stories" nav="" section={params.then((p) => `user ${p.username}`)}>
      <Suspense fallback={<p className="type-meta text-meta">Loading the profile…</p>}>
        <Profile params={params} searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function Profile({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ username }, search, viewer, opts] = await Promise.all([
    params,
    searchParams,
    getViewer(),
    getViewerOpts(),
  ]);
  const user = (await getUserByName(username))!;

  const [posts, comments] = await Promise.all([
    getPostsByAuthor(username, opts),
    getCommentsByAuthor(username, opts),
  ]);

  const tab = search.tab === "comments" ? "comments" : "submissions";

  return (
    <>
      <PageHead title={user.username} />

      <div className="mt-4 max-w-[640px]">
        <DatasheetTable
          rows={[
            [
              "Karma",
              // Total only. The post/comment split needs `Vote.itemType`, which M11 fills in.
              <span key="k" className="font-semibold">
                {formatCount(user.karma)}
              </span>,
            ],
            [
              "Joined",
              <span key="j">
                {user.createdAt.toISOString().slice(0, 10)}{" "}
                <span className="text-meta">{formatAgeLong(user.createdAt)}</span>
              </span>,
            ],
            ["About", user.about || <span className="text-meta">Nothing yet.</span>],
          ]}
          note="Karma is recomputed from votes every night, so today's votes may not show yet."
        />
      </div>

      <Tabs
        current={tab}
        tabs={[
          { key: "submissions", label: "Submissions", count: posts.length, href: `/user/${username}` },
          { key: "comments", label: "Comments", count: comments.length, href: `/user/${username}?tab=comments` },
        ]}
      />

      {tab === "submissions" ? (
        posts.length === 0 ? (
          <p className="mt-6 type-meta text-meta">No submissions yet.</p>
        ) : (
          <StoryList
            rows={toRows(posts, { page: 1, pageSize: posts.length }, (post) => ({
              points: post.scoreRaw,
              post,
            }))}
            viewerName={opts.userId}
            canFlag={viewer?.canFlag ?? false}
          />
        )
      ) : comments.length === 0 ? (
        <p className="mt-6 type-meta text-meta">No comments yet.</p>
      ) : (
        <ol className="mt-4 rule-open">
          {comments.map((comment) => (
            <li key={comment.id} className="rule-divide px-1 py-3">
              <div className="flex flex-wrap items-baseline gap-x-3 type-meta text-meta">
                <span>{formatAgeLong(comment.createdAt)}</span>
                <Link href={`/reply?id=${comment.id}`} className="text-ink-2 hover:underline">
                  link
                </Link>
                <Link href={`/item?id=${comment.postId}`} className="text-ink-2 hover:underline">
                  in thread
                </Link>
              </div>
              <CommentBody text={comment.text} className="mt-1" />
            </li>
          ))}
          <li className="rule-close" />
        </ol>
      )}
    </>
  );
}
