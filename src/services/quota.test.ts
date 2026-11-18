import { describe, expect, it } from "vitest";
import { CFG, HOUR } from "@/lib/config";
import { db } from "@/lib/db";
import { ANONYMOUS, type ViewerOpts } from "@/lib/types";
import { getSubmitQuota } from "./posts";

const MLIN: ViewerOpts = { userId: "mlin", isModerator: false, showDead: false };

// Reads Postgres. Expectations come from the database, not from the fixtures: fixture timestamps
// are derived from *module load time*, so a fresh import and the seeded rows drift apart by however
// long ago the seed ran. Asserting fixture arithmetic against seeded rows tests the clock.
describe.skipIf(!process.env.DATABASE_URL)("the hourly submission allowance", () => {
  // Catches: a signed-out visitor being told they have used part of an allowance that does not
  // apply to them, which is how a "you have reached the limit" notice reaches a page with no form.
  it("is untouched for a signed-out visitor", async () => {
    expect(await getSubmitQuota(ANONYMOUS)).toEqual({
      used: 0,
      limit: CFG.ratePerHour,
      resetAt: null,
    });
  });

  // Catches: counting every post a viewer ever made rather than the last hour's — which would
  // lock out anyone with four submissions in their history, permanently.
  it("counts only this hour's posts", async () => {
    const since = new Date(Date.now() - HOUR);
    const [expected, lifetime] = await Promise.all([
      db.post.count({ where: { author: { username: "mlin" }, createdAt: { gte: since } } }),
      db.post.count({ where: { author: { username: "mlin" } } }),
    ]);

    const quota = await getSubmitQuota(MLIN);
    expect(quota.used).toBe(expected);
    // The window has to actually exclude something, or the assertion above proves nothing.
    expect(expected).toBeLessThan(lifetime);
  });

  // Catches: resetAt computed as now + 1 h, which makes the limit a fixed cooldown instead of a
  // rolling window — every refresh would push the deadline further away and it would never clear.
  // Inserts its own row rather than relying on the seed. The window is one rolling hour and the
  // seed's timestamps are relative to when it ran, so any assertion about "a post in the last hour"
  // silently stops testing anything an hour after seeding — which is how this test first passed and
  // then failed without a line changing.
  it("frees the next slot an hour after the oldest post in the window, not an hour from now", async () => {
    const author = await db.user.findUnique({ where: { username: "mlin" }, select: { id: true } });
    const postedAt = new Date(Date.now() - 20 * 60_000);

    const created = await db.post.create({
      data: {
        authorId: author!.id,
        title: "quota fixture — inserted by a test",
        url: "https://example.invalid/quota-test",
        createdAt: postedAt,
      },
      select: { id: true },
    });

    try {
      const quota = await getSubmitQuota(MLIN);
      expect(quota.used).toBeGreaterThan(0);

      const oldest = await db.post.findFirst({
        where: { author: { username: "mlin" }, createdAt: { gte: new Date(Date.now() - HOUR) } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });

      expect(quota.resetAt?.getTime()).toBe(oldest!.createdAt.getTime() + HOUR);
      // A fixed cooldown would put the reset a full hour out on every refresh and never clear.
      expect(quota.resetAt!.getTime()).toBeLessThan(Date.now() + HOUR);
    } finally {
      // finally, so a failed assertion does not leave a stray post on the front page.
      await db.post.delete({ where: { id: created.id } });
    }
  });
});
