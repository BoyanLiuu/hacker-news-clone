import { describe, expect, it } from "vitest";
import { posts } from "@/fixtures";
import { CFG, HOUR } from "@/lib/config";
import { ANONYMOUS, type ViewerOpts } from "@/lib/types";
import { getSubmitQuota } from "./posts";

const MLIN: ViewerOpts = { userId: "mlin", isModerator: false, showDead: false };

describe("the hourly submission allowance", () => {
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
    const hourAgo = Date.now() - HOUR;
    const expected = posts.filter(
      (p) => p.author === "mlin" && p.createdAt.getTime() >= hourAgo,
    ).length;

    const quota = await getSubmitQuota(MLIN);
    expect(quota.used).toBe(expected);
    expect(quota.used).toBeLessThan(posts.filter((p) => p.author === "mlin").length);
  });

  // Catches: resetAt computed as now + 1 h, which makes the limit a fixed cooldown instead of a
  // rolling window — every refresh would push the deadline further away and it would never clear.
  it("frees the next slot an hour after the oldest post in the window, not an hour from now", async () => {
    const quota = await getSubmitQuota(MLIN);
    expect(quota.used).toBeGreaterThan(0);

    const hourAgo = Date.now() - HOUR;
    const oldest = Math.min(
      ...posts
        .filter((p) => p.author === "mlin" && p.createdAt.getTime() >= hourAgo)
        .map((p) => p.createdAt.getTime()),
    );

    expect(quota.resetAt?.getTime()).toBe(oldest + HOUR);
    expect(quota.resetAt!.getTime()).toBeLessThan(Date.now() + HOUR);
  });
});
