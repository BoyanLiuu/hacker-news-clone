import { describe, expect, it } from "vitest";
import { decideVote, type Existing } from "./vote-decision";

const GRACE = 5 * 60_000;
const NOW = Date.UTC(2026, 10, 19, 12, 0, 0);
const agedMs = (ms: number): Existing => ({ value: 1, createdAt: new Date(NOW - ms) });

describe("decideVote", () => {
  it("records a first vote in the direction clicked", () => {
    expect(decideVote({ existing: null, direction: 1, graceMs: GRACE, now: NOW })).toEqual({ kind: "cast", delta: 1 });
    expect(decideVote({ existing: null, direction: -1, graceMs: GRACE, now: NOW })).toEqual({ kind: "cast", delta: -1 });
  });

  it("treats the same arrow inside the window as taking the vote back", () => {
    expect(decideVote({ existing: agedMs(1000), direction: 1, graceMs: GRACE, now: NOW })).toEqual({
      kind: "unvote",
      delta: -1,
    });
  });

  it("moves the score by two when switching arrows, not by one", () => {
    // Off the old vote and on to the new one. A delta of 1 would leave the score a vote short.
    expect(decideVote({ existing: agedMs(1000), direction: -1, graceMs: GRACE, now: NOW })).toEqual({
      kind: "switch",
      delta: -2,
    });
  });

  /**
   * The bug this file exists for. The first implementation checked the window only when the same
   * arrow was clicked, so a ten-day-old upvote could be flipped to a downvote and flipped back —
   * an unvote and a revote with the window never consulted. Both directions must lock.
   */
  it("locks a vote past the window whichever arrow is clicked", () => {
    const old = agedMs(GRACE + 1);
    expect(decideVote({ existing: old, direction: 1, graceMs: GRACE, now: NOW })).toEqual({ kind: "locked" });
    expect(decideVote({ existing: old, direction: -1, graceMs: GRACE, now: NOW })).toEqual({ kind: "locked" });
  });

  it("locks exactly at the boundary, so the window is closed-ended", () => {
    expect(decideVote({ existing: agedMs(GRACE), direction: 1, graceMs: GRACE, now: NOW }).kind).toBe("locked");
    expect(decideVote({ existing: agedMs(GRACE - 1), direction: 1, graceMs: GRACE, now: NOW }).kind).toBe("unvote");
  });
});
