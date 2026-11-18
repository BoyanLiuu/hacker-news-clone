import { comments, posts, users } from "@/fixtures";
import { db } from "@/lib/db";
import { childPath, depthOf } from "@/lib/path";

/**
 * Seeds Postgres from the phase-1 fixtures.
 *
 * Two jobs, and the second is the reason this is worth more than a few hand-written rows:
 *
 * 1. **A demo database with real conversation.** 69 posts, 14 users and 457 comments, including one
 *    334-comment thread that reaches depth 12 — so the depth cap, collapse, the thread contents
 *    table and `path` ordering are all exercised by actual data rather than by three rows.
 *
 * 2. **An exact boundary check.** M7's real test is stashing the services back to fixtures and
 *    finding the UI identical. That only means something if both sides serve the *same* data, which
 *    is why this seeds from the fixtures rather than inventing new content.
 *
 * `path` is not copied. It is recomputed with `childPath`, the same helper the app uses, and then
 * compared against the value the fixtures already carry — 457 comments' worth of agreement, which
 * is a stronger check on the helper than any unit test in the suite.
 *
 * M8 replaces this with ~2 000 real stories from the HN API via `COPY`. This one stays useful as the
 * small, offline, deterministic dataset.
 *
 * Run: pnpm db:seed
 *
 * The script needs `--env-file=.env`: Next and the Prisma CLI load `.env` themselves, but a bare
 * tsx process does not, and `src/lib/db.ts` is imported before any statement here could load it.
 */

/** Fixture ids are preserved so every `/item?id=38214` URL in the design references still resolves. */
async function main() {
  const existing = await db.post.count();
  if (existing > 0 && process.argv[2] !== "--force") {
    console.log(`${existing} posts already present. Pass --force to wipe and reseed.`);
    return;
  }

  console.log("clearing…");
  // Children first: the FKs are real, so order matters.
  await db.rankedPost.deleteMany();
  await db.frontSnapshot.deleteMany();
  await db.vote.deleteMany();
  await db.flag.deleteMany();
  await db.comment.deleteMany();
  await db.post.deleteMany();
  await db.user.deleteMany();

  console.log(`users: ${allUsers.length} (${users.length} authored, ${allUsers.length - users.length} derived)`);
  await db.user.createMany({
    data: allUsers.map((u) => ({
      id: idFor(u.username),
      // Clerk owns identity from M10 and these accounts have no Clerk session. A `seed:` prefix
      // keeps the unique constraint honest and makes seeded accounts obvious in the table.
      clerkId: `seed:${u.username}`,
      username: u.username,
      about: u.about,
      karma: u.karma,
      isModerator: u.isModerator,
      isShadowBanned: u.isShadowBanned,
      showDead: u.showDead,
      createdAt: u.createdAt,
    })),
  });

  console.log(`posts: ${posts.length}`);
  await db.post.createMany({
    data: posts.map((p) => ({
      id: p.id,
      authorId: idFor(p.author),
      title: p.title,
      url: p.url,
      text: p.text,
      // Derived, not copied — the same `registrableDomain` the fixtures used, so a mismatch here
      // would mean the two disagree.
      domain: p.domain,
      scoreRaw: p.scoreRaw,
      commentCount: p.commentCount,
      isDead: p.isDead,
      isDeleted: p.isDeleted,
      createdAt: p.createdAt,
      editedAt: p.editedAt,
    })),
  });

  // Parents before children, so a parent's path exists when its child is built. Sorting by the
  // fixture path does that: a parent's path is a prefix of its child's, so it sorts first.
  const ordered = [...comments].sort((a, b) => a.path.localeCompare(b.path));

  const pathById = new Map<number, string>();
  const rows = ordered.map((c) => {
    const parentPath = c.parentId === null ? null : (pathById.get(c.parentId) ?? null);
    if (c.parentId !== null && parentPath === null) {
      throw new Error(`comment ${c.id} has parent ${c.parentId}, which was not inserted first`);
    }

    const path = childPath(parentPath, c.id);
    pathById.set(c.id, path);

    // The check that earns this script its keep.
    if (path !== c.path) {
      throw new Error(`path mismatch on comment ${c.id}: computed ${path}, fixture has ${c.path}`);
    }
    const depth = depthOf(path);
    if (depth !== c.depth) {
      throw new Error(`depth mismatch on comment ${c.id}: computed ${depth}, fixture has ${c.depth}`);
    }

    return {
      id: c.id,
      postId: c.postId,
      parentId: c.parentId,
      authorId: idFor(c.author),
      text: c.text,
      path,
      depth,
      scoreRaw: c.scoreRaw,
      childCount: 0, // set below, from the rows themselves
      isDead: c.isDead,
      isDeleted: c.isDeleted,
      isShadow: c.isShadow,
      createdAt: c.createdAt,
    };
  });

  const childCounts = new Map<number, number>();
  for (const row of rows) {
    if (row.parentId !== null) {
      childCounts.set(row.parentId, (childCounts.get(row.parentId) ?? 0) + 1);
    }
  }
  for (const row of rows) row.childCount = childCounts.get(row.id) ?? 0;

  console.log(`comments: ${rows.length} (paths recomputed and verified against the fixtures)`);
  await db.comment.createMany({ data: rows });

  // Explicit ids leave every sequence at 1, so the first real insert would collide with a seeded
  // row and keep colliding until it climbed past the highest seeded id. Nothing in the app would
  // report this as a seeding problem.
  console.log("resetting id sequences past the seeded rows…");
  for (const table of ["User", "Post", "Comment"]) {
    await db.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`,
    );
  }

  const deepest = rows.reduce((max, r) => Math.max(max, r.depth), 0);
  const biggest = [...new Map(rows.map((r) => [r.postId, 0])).keys()]
    .map((postId) => ({ postId, n: rows.filter((r) => r.postId === postId).length }))
    .sort((a, b) => b.n - a.n)[0];

  console.log(
    `\ndone. deepest comment: depth ${deepest}; biggest thread: post ${biggest.postId} with ${biggest.n} comments`,
  );
}

/**
 * The fixtures carry 14 authored profiles but 37 distinct author names: the prototype wrote detail
 * for the users it showed on screen and used the rest only as bylines. Phase 1 never noticed —
 * `findUser` returned null and the byline rendered the string anyway — but a real foreign key does.
 *
 * So the missing 23 are derived from their own content rather than invented: karma is the sum of
 * what they wrote, and `createdAt` is their earliest item, which keeps an account from being
 * younger than its own first comment. `ghost` is the exception and is given a fixed old date — it
 * is HN's byline for a removed author, not a person.
 */
function deriveMissingUsers(): typeof users {
  const known = new Set(users.map((u) => u.username));
  const derived = new Map<string, { karma: number; earliest: Date }>();

  const note = (author: string, score: number, at: Date) => {
    if (known.has(author)) return;
    const row = derived.get(author);
    if (!row) derived.set(author, { karma: Math.max(0, score - 1), earliest: at });
    else {
      row.karma += Math.max(0, score - 1);
      if (at < row.earliest) row.earliest = at;
    }
  };

  for (const p of posts) note(p.author, p.scoreRaw, p.createdAt);
  for (const c of comments) note(c.author, c.scoreRaw, c.createdAt);

  return [...derived].map(([username, { karma, earliest }]) => ({
    username,
    about: "",
    karma,
    isModerator: false,
    isShadowBanned: false,
    showDead: false,
    createdAt: username === "ghost" ? new Date("2015-01-01T00:00:00Z") : earliest,
  }));
}

const allUsers = [...users, ...deriveMissingUsers()];

/**
 * Fixture users have no numeric id — they are keyed by username, which is also what every post and
 * comment references. Assigning ids by position keeps them stable across reseeds.
 */
const userIds = new Map(allUsers.map((u, i) => [u.username, i + 1]));
function idFor(username: string): number {
  const id = userIds.get(username);
  if (id === undefined) throw new Error(`no fixture user named ${username}`);
  return id;
}

// Not top-level await: the package is CJS, where esbuild rejects it. This also gives the script a
// real exit code, so a failed path assertion fails `pnpm db:seed` instead of printing and passing.
main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await db.$disconnect();
    process.exit(1);
  });
