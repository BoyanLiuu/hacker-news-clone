import { describe, expect, it } from "vitest";
import { networkOf } from "./network";

/**
 * The bug these guard is a truncation that keeps too much. If `networkOf` returned the full
 * address, every row in `RateHit` would be a visitor's address and nothing in the app would look
 * different — the rate limit would still work, and the privacy property would be silently gone.
 */
describe("networkOf", () => {
  it("keeps only the first three octets of an IPv4 address", () => {
    expect(networkOf("203.0.113.47")).toBe("203.0.113.0/24");
    // The host part is what identifies a machine, so it must not survive.
    expect(networkOf("203.0.113.47")).not.toContain("47");
  });

  it("gives two addresses on one subnet the same network, and different subnets different ones", () => {
    expect(networkOf("203.0.113.1")).toBe(networkOf("203.0.113.254"));
    expect(networkOf("203.0.113.1")).not.toBe(networkOf("203.0.114.1"));
  });

  it("takes the client from the head of an x-forwarded-for list, not a proxy", () => {
    // Trusting the last entry would rate-limit the CDN rather than the submitter.
    expect(networkOf("203.0.113.47, 70.41.3.18, 150.172.238.178")).toBe("203.0.113.0/24");
  });

  it("unwraps an IPv4-mapped IPv6 address rather than treating it as IPv6", () => {
    expect(networkOf("::ffff:203.0.113.47")).toBe("203.0.113.0/24");
  });

  it("keeps three groups of an IPv6 address", () => {
    expect(networkOf("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe("2001:db8:85a3::/48");
    expect(networkOf("2001:db8:85a3::1")).toBe("2001:db8:85a3::/48");
  });

  /**
   * Returning null matters: the action treats an unknown network as "cannot rate-limit this" and
   * falls back to the per-user limit alone, rather than bucketing every unparseable request
   * together — which would let one malformed header exhaust everyone's allowance at once.
   */
  it("returns null for anything it cannot read, rather than a shared bucket", () => {
    for (const bad of ["", "   ", "not-an-ip", "999.1.1.1", "203.0.113", "::1", null, undefined]) {
      expect(networkOf(bad)).toBeNull();
    }
  });
});
