/**
 * The network a request came from, for the per-network submission limit.
 *
 * Truncated, not hashed: /24 of an IPv4 address and /48 of an IPv6 one. See the `RateHit` model
 * for why truncation beat a salted hash. A full address is never stored, logged or returned.
 *
 * IPv4 /24 is the smallest prefix that still means "a network" for home and office NAT; IPv6 /48
 * is the usual allocation to a single site, so it is the same idea one layer up.
 */
export function networkOf(address: string | null | undefined): string | null {
  if (!address) return null;

  // `x-forwarded-for` is a list, client first. Everything after is proxies.
  const first = address.split(",")[0]?.trim();
  if (!first) return null;

  // An IPv4-mapped IPv6 address ("::ffff:1.2.3.4") is an IPv4 address wearing a hat.
  const unmapped = first.startsWith("::ffff:") ? first.slice(7) : first;

  if (unmapped.includes(".")) {
    const octets = unmapped.split(".");
    if (octets.length !== 4 || !octets.every(isByte)) return null;
    return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
  }

  if (unmapped.includes(":")) {
    // Three groups is /48. A compressed address ("2001:db8::1") still has its first groups intact,
    // so taking the leading three is correct without expanding it — unless it *starts* compressed,
    // which only happens for addresses in ::/16 that no client has.
    const groups = unmapped.split(":");
    if (groups[0] === "") return null;
    const prefix = groups.slice(0, 3);
    if (prefix.length < 3 || !prefix.every(isHextet)) return null;
    return `${prefix.join(":")}::/48`;
  }

  return null;
}

function isByte(part: string): boolean {
  if (!/^\d{1,3}$/.test(part)) return false;
  const n = Number(part);
  return n >= 0 && n <= 255;
}

function isHextet(part: string): boolean {
  return /^[0-9a-fA-F]{1,4}$/.test(part);
}
