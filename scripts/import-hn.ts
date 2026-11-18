/**
 * Import real Hacker News stories and their comment trees.
 *
 * Run: pnpm db:seed:hn [stories]        (default 2000)
 *
 * This is M8. It replaces the *content* of the database, not the fixture seed: `pnpm db:seed` stays
 * as the small deterministic dataset, and this is the realistic one. Keeping both means the demo
 * thread and the unit tests do not depend on whatever the API returned today.
 *
 * ## Why Algolia rather than the Firebase API the plan names
 *
 * Firebase serves one item per request, so 2 000 stories and their replies is upwards of 60 000
 * round trips. Algolia's `/items/{id}` returns a story with its **whole tree nested**, which makes
 * it one request per story — about 2 000. Same data, two orders of magnitude fewer requests, and
 * far gentler on someone else's free API. Both were reachable; this was a choice, not a fallback.
 *
 * ## Why COPY
 *
 * `createMany` batches into a multi-row INSERT, which is fine for hundreds of rows. For ~60 000 it
 * still parses and plans every batch. `COPY FROM STDIN` streams them in one statement, which is
 * what the plan asked for and what makes a reseed take seconds instead of minutes.
 */
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import pg from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { registrableDomain } from "@/lib/domain";
import { childPath, depthOf } from "@/lib/path";

const SCHEMA = "hacker_news_clone";
const TARGET = Number(process.argv[2] ?? 2000);

/** Stories newer than this are what `/` can rank; older ones still populate `/newest`. */
const DAYS_BACK = 30;
/**
 * Politeness, and it needed lowering.
 *
 * At eight concurrent the first full run lost **364 of 1 503 trees** to a burst of rate limiting
 * between roughly the 600th and 1 000th request — four retries with exponential backoff were not
 * enough to ride it out, and the failures arrived in a block rather than scattered, which is the
 * signature of a limiter rather than flaky requests. Four concurrent with a longer ceiling trades a
 * couple of minutes for not quietly dropping a quarter of the import.
 */
const CONCURRENCY = 4;

/**
 * Comments kept per story. **This is a storage decision, measured rather than guessed.**
 *
 * The free tier allows 500 MB for the whole Supabase project, shared with the other apps in it.
 * A 40-story trial imported 14 048 comments — one thread alone had 3 490 — and cost 15.2 MB, which
 * scales to roughly 760 MB for the plan's 2 000 stories. Real comments average 282 characters where
 * the fixtures averaged 88, and every distinct commenter becomes a `User` row (6 086 of them from
 * 40 stories), so the first estimate from fixture data was out by a factor of 25.
 *
 * Capping at 400 keeps what the plan's check actually needs — 2 000 stories to paginate and a
 * thread over 300 comments to render at depth — for about a tenth of the storage.
 *
 * `commentCount` records what is *stored*, not what Hacker News has. A row claiming 3 490 comments
 * above 400 rendered ones would be a number the page cannot back up.
 */
const MAX_COMMENTS_PER_STORY = 400;

type Hit = { objectID: string; num_comments: number | null };

type Item = {
  id: number;
  type: string;
  author: string | null;
  title: string | null;
  url: string | null;
  text: string | null;
  points: number | null;
  created_at_i: number;
  parent_id: number | null;
  children?: Item[];
};

async function getJson<T>(url: string, attempt = 1): Promise<T> {
  const res = await fetch(url, { headers: { "user-agent": "tally-import (personal project)" } });
  if (res.ok) return (await res.json()) as T;

  // 429, **403** and 5xx are worth retrying; a 404 means the item is gone and retrying cannot help.
  //
  // 403 is here because of what the failure tally reported. The first run lost 364 trees and I put
  // it down to rate limiting; once the script printed reasons instead of a count, the actual status
  // was `403 Forbidden` in a contiguous block — Algolia throttling by volume rather than returning
  // 429. It was not in the retry set, so those requests failed on the first attempt. Adding it took
  // the losses from 364 to a far smaller number on the same workload.
  //
  // Six attempts, so the backoff reaches ~25 s; a throttling window outlasted four.
  if ((res.status === 429 || res.status === 403 || res.status >= 500) && attempt <= 6) {
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    return getJson<T>(url, attempt + 1);
  }
  throw new Error(`${res.status} ${res.statusText} for ${url}`);
}

/**
 * Story ids, blended on purpose.
 *
 * `search_by_date` alone returns the very newest submissions, and a test run of 12 of them produced
 * **two** comments between them — fine for paginating `/newest`, useless for a thread. So the set is
 * assembled in three passes, most-discussed first, and deduplicated:
 *
 *   1. big threads (`num_comments>250`) — the plan's check wants a 300+ comment thread to render
 *   2. real discussions (`num_comments>20`) — so most threads have something in them
 *   3. the newest (`points>1`) — fills the rest, so `/newest` looks like `/newest` really does
 *
 * Pass 3 last and capped means the shape stays honest: plenty of thin stories, as on the real site,
 * but not *only* thin stories.
 */
async function collectStoryIds(target: number): Promise<number[]> {
  const since = Math.floor(Date.now() / 1000) - DAYS_BACK * 86_400;
  const seen = new Map<number, number>(); // id -> num_comments

  const pass = async (label: string, filters: string, want: number, byDate: boolean) => {
    const endpoint = byDate ? "search_by_date" : "search";
    let added = 0;
    for (let page = 0; added < want && page < 40; page++) {
      const url =
        `https://hn.algolia.com/api/v1/${endpoint}?tags=story&hitsPerPage=1000&page=${page}` +
        `&numericFilters=created_at_i>${since},${filters}`;
      const { hits } = await getJson<{ hits: Hit[] }>(url);
      if (hits.length === 0) break;

      for (const h of hits) {
        const id = Number(h.objectID);
        if (seen.has(id) || seen.size >= target) continue;
        seen.set(id, h.num_comments ?? 0);
        added++;
        if (added >= want) break;
      }
      process.stdout.write(`\r  ${label}: ${added}  (total ${seen.size}/${target})          `);
    }
    process.stdout.write("\n");
  };

  await pass("big threads   ", "num_comments>250", Math.max(4, Math.floor(target * 0.01)), false);
  await pass("discussions   ", "num_comments>20", Math.floor(target * 0.25), false);
  await pass("newest        ", "points>1", target, true);

  const withReplies = [...seen.values()].filter((n) => n > 0).length;
  const biggest = Math.max(0, ...seen.values());
  console.log(`\n  ${seen.size} stories · ${withReplies} with replies · biggest thread ${biggest} comments\n`);
  return [...seen.keys()];
}

/** Run `work` over `items`, at most `limit` at a time. */
async function mapLimit<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await work(items[i]);
      }
    }),
  );
  return out;
}

type Rows = {
  users: Map<string, { id: number; createdAt: number }>;
  posts: string[][];
  comments: string[][];
};

/**
 * Postgres text-format COPY: tabs separate, backslash escapes, `\N` is NULL.
 *
 * Backslash is escaped first, or the escapes we add would themselves be re-escaped. The control
 * character strip is a guard rather than a fix for anything observed: this import contained none,
 * but a single NUL byte makes Postgres reject the COPY and the whole transaction with it — losing
 * 133 000 rows because of one character in one comment.
 */
function esc(v: string | number | boolean | null): string {
  if (v === null) return "\\N";
  if (typeof v !== "string") return String(v);
  return v
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\t/g, "\\t")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

/**
 * Flatten a story's tree, breadth-first, keeping at most `MAX_COMMENTS_PER_STORY`.
 *
 * Breadth-first matters. Depth-first truncation keeps one deep chain and discards every sibling,
 * which reads as a thread nobody replied to; level by level keeps the shape of the conversation and
 * simply stops going deeper. And a node is only ever kept if its parent was, because `path` encodes
 * ancestry — an orphan would carry a path whose prefix does not exist, and `buildTree` would drop it
 * and its children silently.
 */
function walkTree(story: Item, rows: Rows, userId: (author: string, at: number) => number) {
  let kept = 0;

  type Pending = { node: Item; parentPath: string | null };
  let level: Pending[] = (story.children ?? []).map((node) => ({ node, parentPath: null }));

  while (level.length > 0 && kept < MAX_COMMENTS_PER_STORY) {
    const next: Pending[] = [];

    for (const { node, parentPath } of level) {
      if (kept >= MAX_COMMENTS_PER_STORY) break;
      const path = emit(node, parentPath);
      kept++;
      for (const child of node.children ?? []) next.push({ node: child, parentPath: path });
    }

    level = next;
  }

  return kept;

  function emit(node: Item, parentPath: string | null): string {
    const path = childPath(parentPath, node.id);

    // HN keeps deleted comments as nodes with no author and no text so replies survive. Mirroring
    // that is the point of `isDeleted` — dropping them would orphan live subtrees.
    const deleted = !node.author || node.text === null;

    rows.comments.push([
      esc(node.id),
      esc(story.id),
      esc(parentPath === null ? null : node.parent_id),
      esc(userId(node.author ?? "ghost", node.created_at_i)),
      esc(node.text ?? ""),
      esc(path),
      esc(depthOf(path)),
      esc(Math.max(1, node.points ?? 1)),
      esc((node.children ?? []).length),
      esc(false),
      esc(deleted),
      esc(false),
      esc(new Date(node.created_at_i * 1000).toISOString()),
    ]);

    return path;
  }
}

async function main() {
  console.log(`importing ~${TARGET} Hacker News stories from the last ${DAYS_BACK} days\n`);

  const ids = await collectStoryIds(TARGET);

  const rows: Rows = { users: new Map(), posts: [], comments: [] };
  let nextUserId = 1;
  const userId = (author: string, at: number) => {
    const existing = rows.users.get(author);
    if (existing) {
      // An account cannot be younger than its own oldest item.
      if (at < existing.createdAt) existing.createdAt = at;
      return existing.id;
    }
    const id = nextUserId++;
    rows.users.set(author, { id, createdAt: at });
    return id;
  };

  let done = 0;
  let comments = 0;
  // Reasons, not just a count. The first run lost 364 trees and the script said only "364 failed",
  // so the cause had to be inferred from the shape of the output. A tally by reason says it.
  const failures = new Map<string, number>();

  await mapLimit(ids, CONCURRENCY, async (id) => {
    try {
      const story = await getJson<Item>(`https://hn.algolia.com/api/v1/items/${id}`);
      if (!story.title) return; // deleted between the search and the fetch

      // Walk first: `commentCount` is how many comments were *kept*, and writing the row before
      // knowing that meant patching column 7 by index afterwards — which a column reorder would
      // have broken silently.
      const authorId = userId(story.author ?? "ghost", story.created_at_i);
      const kept = walkTree(story, rows, userId);
      comments += kept;

      rows.posts.push([
        esc(story.id),
        esc(authorId),
        esc(story.title),
        esc(story.url),
        esc(story.text),
        esc(registrableDomain(story.url)),
        esc(Math.max(1, story.points ?? 1)),
        esc(kept),
        esc(false),
        esc(false),
        esc(new Date(story.created_at_i * 1000).toISOString()),
        esc(null),
      ]);
    } catch (error) {
      const reason = error instanceof Error ? error.message.replace(/ for https?:\/\/\S+$/, "") : String(error);
      failures.set(reason, (failures.get(reason) ?? 0) + 1);
    } finally {
      done++;
      if (done % 25 === 0 || done === ids.length) {
        const failed = [...failures.values()].reduce((a, b) => a + b, 0);
        process.stdout.write(`\r  fetched ${done}/${ids.length} trees · ${comments} comments · ${failed} failed   `);
      }
    }
  });

  console.log(`\n\nbuilt ${rows.users.size} users, ${rows.posts.length} posts, ${rows.comments.length} comments`);

  if (failures.size > 0) {
    console.log("\nfetches that failed, by reason:");
    for (const [reason, n] of [...failures].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(5)}  ${reason}`);
    }
    // Said precisely, because the first version of this message guessed 429 and the truth was 403.
    console.log("  (a contiguous block of 403s or 429s is throttling — lower CONCURRENCY)");
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");

    // TRUNCATE, not DELETE. `DELETE FROM "Comment"` across the 133 726 rows of a previous import
    // exceeded Supabase's statement timeout and aborted the whole transaction — so a second import
    // was impossible once the first had succeeded, which is a strange way to discover a bug.
    // TRUNCATE drops the storage instead of walking rows, and one statement listing every table
    // satisfies the foreign keys between them without needing CASCADE or an order.
    await client.query(
      `TRUNCATE ${["Vote", "Flag", "RankedPost", "FrontSnapshot", "Comment", "Post", "User"]
        .map((t) => `"${SCHEMA}"."${t}"`)
        .join(", ")}`,
    );

    const copy = async (table: string, columns: string[], data: string[][]) => {
      const stream = client.query(
        copyFrom(`COPY "${SCHEMA}"."${table}" (${columns.map((c) => `"${c}"`).join(",")}) FROM STDIN`),
      );
      await pipeline(Readable.from(data.map((r) => `${r.join("\t")}\n`)), stream);
      console.log(`  copied ${data.length} into ${table}`);
    };

    await copy(
      "User",
      ["id", "clerkId", "username", "about", "karma", "isModerator", "isShadowBanned", "showDead", "createdAt"],
      [...rows.users].map(([username, u]) => [
        esc(u.id),
        esc(`hn:${username}`),
        esc(username),
        esc(""),
        esc(0), // karma is M11's job to compute from votes; a guess here would be a fabricated number
        esc(false),
        esc(false),
        esc(false),
        esc(new Date(u.createdAt * 1000).toISOString()),
      ]),
    );
    await copy(
      "Post",
      ["id", "authorId", "title", "url", "text", "domain", "scoreRaw", "commentCount", "isDead", "isDeleted", "createdAt", "editedAt"],
      rows.posts,
    );
    await copy(
      "Comment",
      ["id", "postId", "parentId", "authorId", "text", "path", "depth", "scoreRaw", "childCount", "isDead", "isDeleted", "isShadow", "createdAt"],
      rows.comments,
    );

    // Explicit ids leave every sequence at 1, so the first real insert collides with imported rows.
    for (const t of ["User", "Post", "Comment"]) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('"${SCHEMA}"."${t}"', 'id'), COALESCE((SELECT MAX(id) FROM "${SCHEMA}"."${t}"), 1))`,
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  console.log("\ndone.");
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
