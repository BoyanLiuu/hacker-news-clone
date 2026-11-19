import { describe, expect, it } from "vitest";
import { normaliseSubmission, validateEdit, validateSubmission } from "./validate";

describe("validateSubmission", () => {
  it("rejects a post with both a URL and text, naming both fields", () => {
    // Appendix D stores one or the other; a row with both has no display rule.
    const errors = validateSubmission({ title: "T", url: "https://a.com/x", text: "hello" });
    expect(errors.url).toBeDefined();
    expect(errors.text).toBeDefined();
  });

  it("rejects a post with neither", () => {
    expect(validateSubmission({ title: "T", url: "", text: "" }).url).toBeDefined();
  });

  it("accepts a link post and a text post", () => {
    expect(validateSubmission({ title: "T", url: "https://a.com/x", text: "" })).toEqual({});
    expect(validateSubmission({ title: "T", url: "", text: "hello" })).toEqual({});
  });

  it("counts the title after trimming, so spaces cannot pass an empty title", () => {
    expect(validateSubmission({ title: "   ", url: "https://a.com/x", text: "" }).title).toBeDefined();
  });
});

describe("validateEdit", () => {
  /**
   * The bug this exists for. The first version ran `validateSubmission` and deleted the `url` error,
   * so clearing a text post's body produced an error on a key that was then discarded: the edit
   * passed and stored a row with neither a URL nor text, which no listing or thread can render.
   */
  it("refuses to empty a text post's body", () => {
    expect(validateEdit({ title: "T", text: "", hasUrl: false }).text).toBeDefined();
    expect(validateEdit({ title: "T", text: "   ", hasUrl: false }).text).toBeDefined();
  });

  it("allows a link post to have no text, because its URL is the content", () => {
    expect(validateEdit({ title: "T", text: "", hasUrl: true })).toEqual({});
  });

  it("never reports a url error, because an edit cannot change the URL", () => {
    expect(validateEdit({ title: "T", text: "", hasUrl: true }).url).toBeUndefined();
    expect(validateEdit({ title: "T", text: "x", hasUrl: false }).url).toBeUndefined();
  });
});

describe("normaliseSubmission", () => {
  it("stores the unused field as null, not an empty string", () => {
    // `visiblePostWhere` and the row's display logic branch on null; "" would read as a text post
    // with an empty body.
    expect(normaliseSubmission({ title: " T ", url: "https://a.com/x", text: "" })).toEqual({
      title: "T",
      url: "https://a.com/x",
      text: null,
    });
    expect(normaliseSubmission({ title: "T", url: "   ", text: "body" }).url).toBeNull();
  });
});
