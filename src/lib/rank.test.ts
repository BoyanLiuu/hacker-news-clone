import { describe, expect, it } from "vitest";
import { CFG, HOUR } from "./config";
import { isCandidate, rank } from "./rank";

describe("rank", () => {
  // Catches: a sign or precedence slip in (points - 1) / (age + 2) ^ gravity, which silently
  // reorders the whole front page while every row still looks plausible.
  it("matches hand-computed values at known inputs", () => {
    // 97 points at 2.2 h — the worked example printed under Figure 1.
    expect(rank(97, 2.2)).toBeCloseTo((97 - 1) / Math.pow(4.2, 1.8), 10);
    expect(rank(97, 2.2)).toBeCloseTo(7.25, 2);
    // A single-point post scores zero: the -1 discounts the author's own vote.
    expect(rank(1, 0)).toBe(0);
    // The +2 keeps a brand-new post finite rather than dividing by ~0.
    expect(Number.isFinite(rank(500, 0))).toBe(true);
    expect(rank(500, 0)).toBeCloseTo(499 / Math.pow(2, 1.8), 10);
  });

  // Catches: decay inverted, so old posts outrank new ones at equal score.
  it("decays with age at equal points", () => {
    expect(rank(100, 1)).toBeGreaterThan(rank(100, 10));
    expect(rank(100, 10)).toBeGreaterThan(rank(100, 100));
  });

  // Catches: the debrief's own worked case breaking — a fresh modest post must beat a stale big one.
  it("puts a 2-hour 20-point post above a 2-day 80-point post", () => {
    expect(rank(20, 2)).toBeGreaterThan(rank(80, 48));
  });

  // Catches: gravity wired as a multiplier or ignored, so tuning it does nothing.
  it("sharpens decay as gravity rises", () => {
    const young = 2;
    const old = 48;
    const ratioAt = (g: number) => rank(100, young, g) / rank(100, old, g);
    expect(ratioAt(2.4)).toBeGreaterThan(ratioAt(CFG.gravity));
    expect(ratioAt(CFG.gravity)).toBeGreaterThan(ratioAt(1.2));
  });
});

describe("isCandidate", () => {
  // Catches: an off-by-one at the window edge letting the whole table into the front-page sort,
  // which is the bound the architecture relies on for its 200 ms target.
  it("includes posts inside the 7-day window and excludes older ones", () => {
    const now = new Date("2026-11-17T12:00:00Z");
    const hoursAgo = (h: number) => new Date(now.getTime() - h * HOUR);
    expect(isCandidate(hoursAgo(0), now)).toBe(true);
    expect(isCandidate(hoursAgo(CFG.windowDays * 24 - 1), now)).toBe(true);
    expect(isCandidate(hoursAgo(CFG.windowDays * 24), now)).toBe(false);
    expect(isCandidate(hoursAgo(CFG.windowDays * 24 + 1), now)).toBe(false);
  });

  // Catches: a future-dated row ranking above everything, since a negative age inflates the score.
  it("excludes posts dated in the future", () => {
    const now = new Date("2026-11-17T12:00:00Z");
    expect(isCandidate(new Date(now.getTime() + HOUR), now)).toBe(false);
  });
});
