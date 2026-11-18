/**
 * The registrable domain of a URL — what shows beside a title and links to a domain listing.
 *
 * "news.bbc.co.uk" must reduce to "bbc.co.uk", not "co.uk": reducing to the public suffix would
 * merge every unrelated BBC-and-anything-else site onto one /from page.
 *
 * This is a deliberately small list rather than the full Public Suffix List. The full PSL is ~250 KB
 * and changes monthly; these cover the suffixes a link aggregator actually sees. Add to it when a
 * real link proves it is missing.
 */
const MULTIPART_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "net.uk", "sch.uk",
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "id.au",
  "co.nz", "net.nz", "org.nz", "govt.nz", "ac.nz",
  "co.jp", "or.jp", "ne.jp", "ac.jp", "go.jp",
  "co.kr", "or.kr", "ac.kr",
  "com.br", "net.br", "org.br", "gov.br",
  "com.cn", "net.cn", "org.cn", "gov.cn", "edu.cn",
  "co.in", "net.in", "org.in", "gov.in", "ac.in",
  "com.mx", "com.ar", "com.tr", "com.sg", "com.hk", "com.tw", "com.my",
  "co.za", "org.za", "co.il", "org.il", "ac.il",
  "gov.us", "k12.us",
]);

export function registrableDomain(url: string | null | undefined): string | null {
  if (!url) return null;

  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host) return null;

  // An IP address has no registrable domain to reduce.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return host;

  host = host.replace(/^www\./, "").replace(/\.$/, "");
  const parts = host.split(".");
  if (parts.length <= 2) return host;

  const lastTwo = parts.slice(-2).join(".");
  // One extra label when the final two are a public suffix: bbc.co.uk, not co.uk.
  return MULTIPART_SUFFIXES.has(lastTwo) ? parts.slice(-3).join(".") : lastTwo;
}
