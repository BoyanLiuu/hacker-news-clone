import { describe, expect, it } from "vitest";
import { registrableDomain } from "./domain";

describe("registrableDomain", () => {
  // Catches: reducing to the public suffix, so news.bbc.co.uk becomes co.uk and every unrelated
  // .co.uk site is merged onto one /from page.
  it("keeps the registrable label above a multi-part public suffix", () => {
    expect(registrableDomain("https://news.bbc.co.uk/a/b")).toBe("bbc.co.uk");
    expect(registrableDomain("https://blog.example.com.au/post")).toBe("example.com.au");
    expect(registrableDomain("https://a.b.c.co.jp/x")).toBe("c.co.jp");
  });

  // Catches: subdomains splitting one site across several domain pages.
  it("collapses subdomains to the registrable domain", () => {
    expect(registrableDomain("https://deep.sub.example.com/x")).toBe("example.com");
    expect(registrableDomain("https://example.com/x")).toBe("example.com");
  });

  // Catches: www-prefixed and bare URLs for the same site counting as two domains, which also
  // breaks duplicate detection.
  it("treats www as the same site", () => {
    expect(registrableDomain("https://www.example.com/x")).toBe("example.com");
    expect(registrableDomain("https://www.bbc.co.uk/news")).toBe("bbc.co.uk");
  });

  // Catches: a malformed or missing URL throwing during render — text posts have no URL at all.
  it("returns null rather than throwing for absent or unparsable input", () => {
    expect(registrableDomain(null)).toBeNull();
    expect(registrableDomain(undefined)).toBeNull();
    expect(registrableDomain("")).toBeNull();
    expect(registrableDomain("not a url")).toBeNull();
    expect(registrableDomain("/relative/path")).toBeNull();
  });

  // Catches: an IP host being chopped into "1.1" and linking to a nonsense domain page.
  it("leaves an IP host intact", () => {
    expect(registrableDomain("http://192.168.1.10/x")).toBe("192.168.1.10");
  });

  it("lowercases the host", () => {
    expect(registrableDomain("https://EXAMPLE.COM/x")).toBe("example.com");
  });
});
