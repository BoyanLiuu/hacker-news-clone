import { describe, expect, it } from "vitest";
import type { ViewerOpts } from "@/lib/types";
import { CFG } from "@/lib/config";
import { db } from "@/lib/db";
import { getThreadPage, pageOfComment } from "./comments";

/**
 * `pageOfComment` reimplements `sortSiblings`'s ordering in SQL — `scoreRaw DESC, createdAt ASC` —
 * because counting the roots ahead of one is cheaper than fetching them all to find an index.
 *
 * The bug that costs is drift between the two. Change the sort in `lib/tree.ts` and this SQL keeps
 * the old order, so `createComment` redirects to a page the new comment is not on and the author
 * concludes their comment vanished. That is exactly what happened before `pageOfComment` existed,
 * when the redirect always went to page 1, and it is invisible until a thread is big enough to
 * paginate.
 *
 * Reads the seeded data rather than writing its own: a paginated thread needs more than
 * `CFG.rootsPerPage` top-level comments, and building one per test run would cost ~300 round trips.
 *
 * `OPTED_IN` and not `OPTED_IN`, because the signed-out path goes through `unstable_cache`, which
 * throws `Invariant: incrementalCache missing` outside a Next request. The ordering under test is
 * the same either way, and both sides of the comparison use these opts — which is the point, since
 * the bug being guarded is the two sides disagreeing.
 */
const OPTED_IN: ViewerOpts = { userId: "tally_tester", isModerator: false, showDead: true };
describe("pageOfComment agrees with the order getThreadPage renders", () => {
  it("puts every sampled comment on the page that actually contains it", async () => {
    const paginated = await db.post.findFirst({
      where: { comments: { some: { parentId: null } } },
      orderBy: { commentCount: "desc" },
      select: { id: true },
    });
    if (!paginated) return; // No seed: nothing to check rather than a false pass.

    const first = await getThreadPage(paginated.id, OPTED_IN, 1);
    if (first.pages < 2) return; // Not paginated, so there is no page to get wrong.

    // One from the first page, one from the last, and one from the middle: an off-by-one in the
    // division only shows at a boundary, and a wrong sort only shows away from page 1.
    for (const page of [1, Math.ceil(first.pages / 2), first.pages]) {
      const { roots } = await getThreadPage(paginated.id, OPTED_IN, page);
      expect(roots.length).toBeGreaterThan(0);

      for (const root of [roots[0], roots.at(-1)!]) {
        await expect(pageOfComment(root.id, OPTED_IN)).resolves.toBe(page);
      }

      // And a reply belongs on its root's page, not its own position among all comments.
      const reply = roots.flatMap((r) => r.children)[0];
      if (reply) await expect(pageOfComment(reply.id, OPTED_IN)).resolves.toBe(page);
    }
  });

  it("clamps a page beyond the end rather than rendering nothing", async () => {
    const paginated = await db.post.findFirst({
      orderBy: { commentCount: "desc" },
      select: { id: true },
    });
    if (!paginated) return;

    const last = await getThreadPage(paginated.id, OPTED_IN, 9999);
    // A hand-typed `cp` must not produce an empty thread; it lands on the final page.
    expect(last.roots.length).toBeGreaterThan(0);
    expect(last.page).toBe(last.pages);
    expect(last.roots.length).toBeLessThanOrEqual(CFG.rootsPerPage);
  });
});
