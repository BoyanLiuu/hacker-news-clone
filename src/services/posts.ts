import { cache } from "react";
import { postById, posts } from "@/fixtures";
import { CFG, DAY } from "@/lib/config";
import { ageHoursBetween, isCandidate, pointsAt, rank } from "@/lib/rank";
import { NotImplementedInStaticPhase, type Page, type Post, type ScoredPost, type ViewerOpts } from "@/lib/types";
import { reachableAtPermalink, visiblePost } from "./visibility";

/**
 * Reads over fixtures. Every signature here is the one phase 2 reimplements over Prisma —
 * async from the first milestone, ViewerOpts on every read, so nothing above this layer changes.
 *
 * The expensive reads are wrapped in React.cache() so a page that needs the same data twice pays
 * once per request (ARCHITECTURE §5). Outside a request — in tests — the functions still run, they
 * simply do not dedupe.
 */

function paginate<T>(items: T[], page: number, pageSize = CFG.pageSize): Page<T> {
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return { items: slice, page, pageSize, total: items.length, hasNext: start + pageSize < items.length };
}

const newestFirst = (a: Post, b: Post) => b.createdAt.getTime() - a.createdAt.getTime();

/** Visible posts, newest first — the shape every chronological listing wants. */
function listNewest(opts: ViewerOpts, extra: (post: Post) => boolean = () => true): Post[] {
  return posts.filter((p) => extra(p) && visiblePost(p, opts)).sort(newestFirst);
}

/**
 * Front-page candidates: visible posts inside the 7-day window, scored and sorted.
 * `at` back-projects points for /front/:date. This is also what Figure 1 plots.
 */
export const getCandidates = cache(
  async (opts: ViewerOpts, at: Date = new Date(), gravity: number = CFG.gravity): Promise<ScoredPost[]> => {
    const now = new Date();
    return posts
      .filter((p) => visiblePost(p, opts) && p.createdAt <= at && isCandidate(p.createdAt, at))
      .map((post) => {
        const points = pointsAt(post.scoreRaw, post.createdAt, at, now);
        const ageHours = ageHoursBetween(post.createdAt, at);
        return { post, points, ageHours, score: rank(points, ageHours, gravity) };
      })
      .sort((a, b) => b.score - a.score);
  },
);

export async function getRankedPage(page: number, opts: ViewerOpts, at?: Date): Promise<Page<ScoredPost>> {
  return paginate(await getCandidates(opts, at ?? new Date()), page);
}

export async function getNewestPage(page: number, opts: ViewerOpts): Promise<Page<Post>> {
  return paginate(listNewest(opts), page);
}

export async function getPostsByDomain(domain: string, page: number, opts: ViewerOpts): Promise<Page<Post>> {
  const needle = domain.toLowerCase().replace(/^www\./, "");
  return paginate(listNewest(opts, (p) => p.domain === needle), page);
}

/** A dead post is reachable here even though listings hide it. */
export const getPostById = cache(async (id: number, opts: ViewerOpts): Promise<Post | null> => {
  const post = postById.get(id);
  if (!post || !reachableAtPermalink(post, opts)) return null;
  return post;
});

export async function getPostsByAuthor(username: string, opts: ViewerOpts): Promise<Post[]> {
  return listNewest(opts, (p) => p.author === username);
}

/** True when this URL was already posted inside the duplicate window — M11 redirects to it. */
export async function findDuplicate(url: string, opts: ViewerOpts): Promise<Post | null> {
  const cutoff = Date.now() - CFG.dupDays * DAY;
  return (
    posts.find((p) => p.url === url && p.createdAt.getTime() >= cutoff && visiblePost(p, opts)) ?? null
  );
}

/* Mutations are declared so callers can be written against them now. Forms render and validate;
   they cannot persist until M7 brings the database. */

export async function submitPost(_input: { title: string; url?: string; text?: string }): Promise<Post> {
  throw new NotImplementedInStaticPhase("submitPost");
}

export async function editPost(_id: number, _input: { title: string; text?: string }): Promise<Post> {
  throw new NotImplementedInStaticPhase("editPost");
}

export async function deletePost(_id: number): Promise<void> {
  throw new NotImplementedInStaticPhase("deletePost");
}
