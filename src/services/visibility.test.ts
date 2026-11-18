import { describe, expect, it } from "vitest";
import { comments, posts } from "@/fixtures";
import { ANONYMOUS, type ViewerOpts } from "@/lib/types";
import { getThread } from "./comments";
import { getNewestPage, getPostById } from "./posts";

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

describe("dead items", () => {
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

describe("shadow bans", () => {
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

describe("deleted comments", () => {
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
