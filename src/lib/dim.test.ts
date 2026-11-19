import { describe, expect, it } from "vitest";
import { dimFor } from "./dim";

/**
 * The bug these guard is a ramp whose branches are in the wrong order, which is easy to write and
 * invisible on the current data: every imported comment scores exactly 1, so a ramp that fades the
 * wrong side would look identical in the app until someone cast a downvote.
 */
describe("dimFor", () => {
  it("leaves an unvoted comment at full ink — 1 is where every comment starts", () => {
    expect(dimFor(1)).toBe("text-ink-2");
    expect(dimFor(50)).toBe("text-ink-2");
  });

  it("fades monotonically as the score falls, and only below 1", () => {
    const steps = [1, 0, -1, -3, -4, -100].map(dimFor);
    expect(steps).toEqual([
      "text-ink-2",
      "text-dim-1",
      "text-dim-2",
      "text-dim-2",
      "text-dim-3",
      "text-dim-3",
    ]);
  });

  it("never skips a step: each boundary moves exactly one place down the ramp", () => {
    // Catches an off-by-one that would jump 0 straight to dim-2 and leave dim-1 unreachable.
    const ramp = ["text-ink-2", "text-dim-1", "text-dim-2", "text-dim-3"];
    const seen = [1, 0, -1, -4].map(dimFor);
    expect(seen).toEqual(ramp);
  });
});
