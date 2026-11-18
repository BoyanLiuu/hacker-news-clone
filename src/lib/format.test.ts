import { describe, expect, it } from "vitest";
import { formatAge, formatMinutesLeft, formatUntil, formatUtcClock } from "./format";

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

const ahead = (ms: number) => new Date(NOW.getTime() + ms);

describe("formatUntil", () => {
  // Catches: rounding a wait down, so a reader told "in 1 minute" tries again and is refused
  // again. A deadline a person has to act on must never read as sooner than it is.
  it("rounds up, never down", () => {
    expect(formatUntil(ahead(90_000), NOW)).toBe("in 2 minutes");
    expect(formatUntil(ahead(49 * MIN + 1_000), NOW)).toBe("in 50 minutes");
    expect(formatUntil(ahead(30_000), NOW)).toBe("in 1 minute");
  });

  // Catches: "in 0 minutes" or "in -3 minutes" once the deadline has passed under clock skew.
  it("does not render zero or negative waits", () => {
    expect(formatUntil(NOW, NOW)).toBe("in under a minute");
    expect(formatUntil(ago(5 * MIN), NOW)).toBe("in under a minute");
  });

  // Catches: an hours branch being reintroduced. Rounding minutes into hours cannot both round up
  // and stay close: 61 minutes becomes either "in 1 hour" (too soon, the bug above) or "in 2
  // hours" (nearly an hour late). Exact minutes avoid the choice.
  it("stays in minutes past an hour", () => {
    expect(formatUntil(ahead(60 * MIN), NOW)).toBe("in 60 minutes");
    expect(formatUntil(ahead(61 * MIN), NOW)).toBe("in 61 minutes");
  });
});

describe("formatMinutesLeft", () => {
  // Catches: an expired edit window still offering "edit (0 min left)" — a control that looks
  // live and will be refused by the action. Null is how the caller knows to stop offering it.
  it("returns null once the window has closed", () => {
    expect(formatMinutesLeft(NOW, NOW)).toBeNull();
    expect(formatMinutesLeft(ago(MIN), NOW)).toBeNull();
    expect(formatMinutesLeft(ahead(30_000), NOW)).toBe("1 min left");
  });

  // Catches: showing "1 h left" for 80 minutes, which hides that over an hour remains.
  it("stays in minutes across the hour", () => {
    expect(formatMinutesLeft(ahead(80 * MIN), NOW)).toBe("80 min left");
    expect(formatMinutesLeft(ahead(120 * MIN), NOW)).toBe("120 min left");
  });
});

describe("formatUtcClock", () => {
  // Catches: a local-time deadline rendered beside the "UTC" label the design puts next to it.
  it("is hh:mm in UTC regardless of the machine's zone", () => {
    expect(formatUtcClock(new Date("2026-11-17T15:21:48Z"))).toBe("15:21");
  });
});
