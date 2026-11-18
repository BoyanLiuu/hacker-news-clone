import { describe, expect, it } from "vitest";
import { formatAge } from "./format";

const NOW = new Date("2026-11-17T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MIN = 60_000;
const HOUR = 60 * MIN;

describe("formatAge", () => {
  // Catches: a unit boundary that reads wrong in a 52px column — "60 min" instead of "1 h", or
  // "48 h" instead of "2 d". The age column is how a reader judges whether a story is fresh.
  it("switches unit at the right boundaries", () => {
    expect(formatAge(ago(30_000), NOW)).toBe("30 s");
    expect(formatAge(ago(90_000), NOW)).toBe("2 min");
    expect(formatAge(ago(54 * MIN), NOW)).toBe("54 min");
    expect(formatAge(ago(60 * MIN), NOW)).toBe("1 h");
    expect(formatAge(ago(5 * HOUR), NOW)).toBe("5 h");
    expect(formatAge(ago(47 * HOUR), NOW)).toBe("47 h");
    expect(formatAge(ago(48 * HOUR), NOW)).toBe("2 d");
    expect(formatAge(ago(30 * 24 * HOUR), NOW)).toBe("30 d");
  });

  // Catches: clock skew between server and fixture data rendering "-3 min", which looks broken.
  it("never renders a negative age", () => {
    expect(formatAge(new Date(NOW.getTime() + 5 * MIN), NOW)).toBe("0 s");
  });
});
