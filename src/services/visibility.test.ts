import { describe, expect, it } from "vitest";
import { comments, posts, users } from "@/fixtures";
import { ANONYMOUS, type Comment, type ViewerOpts } from "@/lib/types";
import { getCommentsByAuthor, getThread } from "./comments";
import { getNewestPage, getPostById, getPostsByAuthor } from "./posts";
import { collapseShadow } from "./visibility";

const MOD: ViewerOpts = { userId: "moss", isModerator: true, showDead: true };
const OPTED_IN: ViewerOpts = { userId: "mlin", isModerator: false, showDead: true };

async function allNewest(opts: ViewerOpts) {
  const first = await getNewestPage(1, opts);
  const items = [...first.items];
  for (let page = 2; items.length < first.total; page++) {
    items.push(...(await getNewestPage(page, opts)).items);
  }
  return items;
}

// These read Postgres: they are the check that the `where` clauses in visibility.ts enforce the
// same three rules the fixture predicates did. Skipped without a database rather than failed, so a
// clone with no .env still runs the pure unit tests.
const withDb = describe.skipIf(!process.env.DATABASE_URL);

withDb("dead items", () => {
  const dead = posts.find((p) => p.isDead);

  it("has a dead post in the fixtures to test against", () => {
    expect(dead).toBeDefined();
  });

  // Catches: a flagged item still appearing in listings — the flag did nothing — or becoming
  // unreachable at its permalink, which would break every existing link to the discussion.
  it("is hidden from listings but still resolves at its permalink", async () => {
    const listed = await allNewest(ANONYMOUS);
    expect(listed.some((p) => p.id === dead!.id)).toBe(false);
    expect(await getPostById(dead!.id, ANONYMOUS)).not.toBeNull();
  });

  // Catches: the show-dead preference being ignored, so the setting appears to do nothing.
  it("appears in listings for a viewer who opted in, and for moderators", async () => {
    expect((await allNewest(OPTED_IN)).some((p) => p.id === dead!.id)).toBe(true);
    expect((await allNewest(MOD)).some((p) => p.id === dead!.id)).toBe(true);
  });

  it("shows more posts to a moderator than to a signed-out reader", async () => {
    expect((await getNewestPage(1, MOD)).total).toBeGreaterThan((await getNewestPage(1, ANONYMOUS)).total);
  });
});

withDb("shadow bans", () => {
  const shadowed = comments.find((c) => c.isShadow);

  it("has a shadow-banned comment in the fixtures to test against", () => {
    expect(shadowed).toBeDefined();
  });

  // Catches: a shadow-banned user's content leaking to signed-out visitors, which defeats the
  // entire point of a shadow ban — the author must not be able to tell.
  it("hides the comment from everyone except its author and moderators", async () => {
    const postId = shadowed!.postId;
    const seenBy = async (opts: ViewerOpts) => {
      const flat: number[] = [];
      const walk = (nodes: Awaited<ReturnType<typeof getThread>>) => {
        for (const n of nodes) {
          flat.push(n.id);
          walk(n.children);
        }
      };
      walk(await getThread(postId, opts));
      return flat.includes(shadowed!.id);
    };

    expect(await seenBy(ANONYMOUS)).toBe(false);
    expect(await seenBy({ userId: "someone-else", isModerator: false, showDead: true })).toBe(false);
    expect(await seenBy({ userId: shadowed!.author, isModerator: false, showDead: false })).toBe(true);
    expect(await seenBy(MOD)).toBe(true);
  });
});

describe("labelling shadowed rows for moderators", () => {
  const banned = users.find((u) => u.isShadowBanned);

  it("has a shadow-banned user in the fixtures to test against", () => {
    expect(banned).toBeDefined();
  });

  // Catches: a moderator being shown a comment they can only see because its author is banned,
  // with nothing saying so. Unlabelled, hidden content reads as public content, and the moderator
  // replies to it in the open — which tells the banned author they are banned.
  //
  // Built rather than taken from the fixtures because the one banned author's comment is also
  // flagged individually, so the author-ban branch has no fixture that reaches it.
  it("marks a banned author's comment even when the row itself is not flagged", () => {
    const row: Comment = {
      id: -1,
      postId: 1,
      parentId: null,
      author: banned!.username,
      text: "unflagged, but by a banned author",
      path: "0000000001",
      depth: 0,
      scoreRaw: 1,
      createdAt: new Date(),
      isDead: false,
      isDeleted: false,
      isShadow: false,
    };

    expect(collapseShadow(row, true).isShadow).toBe(true);
  });

  // Catches: the collapse allocating a new object for every row in a 300-comment thread.
  it("returns the same row untouched when nothing is shadowed", () => {
    const clean = comments.find((c) => !c.isShadow && c.author !== banned!.username)!;
    expect(collapseShadow(clean, false)).toBe(clean);
  });
});

withDb("filtering by author", () => {
  // Catches: a caller's `author` filter being overwritten by the visibility clause's own `author`
  // filter. Both set the same key, so spreading them lets the later one silently win — and the
  // failure is not an error, it is a profile page listing *everybody's* submissions. Found by the
  // M7 boundary check, fixed by composing every where with AND.
  it("returns only that author's posts and comments", async () => {
    const [posts, comments] = await Promise.all([
      getPostsByAuthor("mlin", ANONYMOUS),
      getCommentsByAuthor("mlin", ANONYMOUS),
    ]);

    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((p) => p.author === "mlin")).toBe(true);
    expect(comments.every((c) => c.author === "mlin")).toBe(true);

    // And it is a real filter, not an accident of a small table.
    const everything = await getNewestPage(1, ANONYMOUS);
    expect(everything.total).toBeGreaterThan(posts.length);
  });
});

withDb("deleted comments", () => {
  const deleted = comments.find((c) => c.isDeleted);
  const reply = comments.find((c) => c.parentId === deleted?.id);

  it("has a deleted comment with a reply in the fixtures to test against", () => {
    expect(deleted).toBeDefined();
    expect(reply).toBeDefined();
  });

  // Catches: filtering deleted comments out of the thread, which orphans their replies and drops
  // a live subtree from the render. The debrief requires a deleted comment with children to stay
  // as [deleted] and keep them; only a childless one vanishes. The renderer decides how it looks —
  // the service must not remove it.
  it("stays in the tree so its replies survive", async () => {
    const flat: number[] = [];
    const walk = (nodes: Awaited<ReturnType<typeof getThread>>) => {
      for (const n of nodes) {
        flat.push(n.id);
        walk(n.children);
      }
    };
    walk(await getThread(deleted!.postId, ANONYMOUS));

    expect(flat).toContain(deleted!.id);
    expect(flat).toContain(reply!.id);
  });
});
