import { CFG } from "./config";

/**
 * Submission rules, written once and run twice.
 *
 * The client form runs these so the errors are live as you type; the action runs the same function
 * because a Server Action is a public endpoint and the client copy is a courtesy, never the gate.
 * One function rather than two implementations of the same prose, which is what the plan means by
 * "the same schema the form uses".
 *
 * Hand-written rather than Zod: the schema has to be importable by a `"use client"` module, which
 * would pull the whole validator into the client bundle. The front page already ships 313 KB gz
 * against a 177 KB recorded budget (ARCHITECTURE §6.3), so a dependency bought nothing here that
 * twenty lines do not.
 */
export type SubmitFields = { title: string; url: string; text: string };
export type SubmitErrors = { title?: string; url?: string; text?: string };

/** Mirrors the browser's own `type="url"` check closely enough that the two never disagree. */
const URL_SHAPE = /^https?:\/\/\S+\.\S+/;

export function validateSubmission({ title, url, text }: SubmitFields): SubmitErrors {
  const errors: SubmitErrors = {};
  const trimmedTitle = title.trim();

  if (!trimmedTitle) errors.title = "Add a title.";
  else if (trimmedTitle.length > CFG.titleMax) {
    errors.title = `Shorten the title to ${CFG.titleMax} characters.`;
  }

  const hasUrl = url.trim().length > 0;
  const hasText = text.trim().length > 0;

  // url XOR text — Appendix D stores one or the other, and a row with both has no display rule.
  if (hasUrl && hasText) {
    errors.url = "Use a URL or text, not both. Clear one of them.";
    errors.text = "Use a URL or text, not both.";
  } else if (!hasUrl && !hasText) {
    errors.url = "Add a URL, or write a text post below.";
  } else if (hasUrl && !URL_SHAPE.test(url.trim())) {
    errors.url = "That does not look like a URL. It should start with http:// or https://.";
  }

  return errors;
}

/** The comment body. Its own function because a reply has no title and no url/text choice. */
export function validateComment(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return "Write something first.";
  if (trimmed.length > CFG.commentMax) return `Shorten this to ${CFG.commentMax} characters.`;
  return undefined;
}

/**
 * What actually gets stored, once validated. Returned separately from the errors so the action
 * cannot accidentally persist the raw strings: the title is trimmed, and the empty one of
 * url/text becomes null rather than "", because `visiblePostWhere` and the row's own display
 * logic branch on null.
 */
export function normaliseSubmission({ title, url, text }: SubmitFields): {
  title: string;
  url: string | null;
  text: string | null;
} {
  const trimmedUrl = url.trim();
  const trimmedText = text.trim();

  return {
    title: title.trim(),
    url: trimmedUrl || null,
    text: trimmedText || null,
  };
}

/**
 * The rules for an *edit*, which are not the submission rules minus a field.
 *
 * A post's url/text choice is fixed at submission, so an edit validates against what the post
 * already is: a link post may have empty text, and a text post may not. Running
 * `validateSubmission` and deleting the `url` error got this wrong — clearing a text post's body
 * produced "Add a URL, or write a text post below" on a key that was then discarded, so the edit
 * passed and stored a row with neither a URL nor text, which no listing or thread can render.
 */
export function validateEdit({ title, text, hasUrl }: { title: string; text: string; hasUrl: boolean }): SubmitErrors {
  const errors: SubmitErrors = {};
  const trimmedTitle = title.trim();

  if (!trimmedTitle) errors.title = "Add a title.";
  else if (trimmedTitle.length > CFG.titleMax) {
    errors.title = `Shorten the title to ${CFG.titleMax} characters.`;
  }

  if (!hasUrl && !text.trim()) {
    errors.text = "A text post needs text. Add some, or delete the post instead.";
  }

  return errors;
}
