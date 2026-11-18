"use client";

import { useState } from "react";
import { CFG } from "@/lib/config";
import { registrableDomain } from "@/lib/domain";
import { Field, OrDivider, PrimaryButton, textInputClass } from "./field";
import { Notice } from "./notice";

type Errors = { title?: string; url?: string; text?: string };

/**
 * The rate-limited state, formatted on the server. Both strings are read off the clock, so
 * computing them here would hydrate against a different minute than the server rendered.
 */
export type Blocked = { at: string; until: string; used: number };

/**
 * The submit form. Validation runs here so the counter and the errors are live, and the same rules
 * run again in the Server Action in M12 — the client copy is a courtesy, never the gate.
 *
 * Nothing persists yet: the service throws `NotImplementedInStaticPhase`, so submitting shows what
 * would happen rather than pretending to work.
 */
export function SubmitForm({
  viewerName,
  blocked,
}: {
  viewerName: string | null;
  blocked: Blocked | null;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<Errors | null>(null);

  const count = Object.keys(errors ?? {}).length;
  // Shown under the field as you type, so the listing's byline is not a surprise after submitting.
  const domain = registrableDomain(url.trim());

  function validate(event: React.FormEvent) {
    event.preventDefault();
    const found: Errors = {};

    if (!title.trim()) found.title = "Add a title.";
    else if (title.length > CFG.titleMax) found.title = `Shorten the title to ${CFG.titleMax} characters.`;

    const hasUrl = url.trim().length > 0;
    const hasText = text.trim().length > 0;

    if (hasUrl && hasText) {
      found.url = "Use a URL or text, not both. Clear one of them.";
      found.text = "Use a URL or text, not both.";
    } else if (!hasUrl && !hasText) {
      found.url = "Add a URL, or write a text post below.";
    } else if (hasUrl && !/^https?:\/\/\S+\.\S+/.test(url.trim())) {
      found.url = "That does not look like a URL. It should start with http:// or https://.";
    }

    setErrors(found);
  }

  return (
    <form onSubmit={validate} noValidate className="max-w-[640px]">
      {/* Above the fields, and the fields stay enabled: the draft is the thing worth protecting
          when you have hit the limit, so you can keep writing. Submit stays disabled until the
          page is loaded again — the quota is read on the server, and nothing here polls it. */}
      {blocked ? (
        <Notice tone="amber">
          <strong>
            You&rsquo;ve reached {blocked.used} submission{blocked.used === 1 ? "" : "s"} this hour.
          </strong>{" "}
          You can submit again at {blocked.at} UTC, {blocked.until}. Your draft stays here.
        </Notice>
      ) : null}

      {errors && count > 0 ? (
        <Notice tone="red">
          <strong>
            Check {count} thing{count === 1 ? "" : "s"} below.
          </strong>{" "}
          Everything you typed is still here.
        </Notice>
      ) : null}

      {errors && count === 0 ? (
        <Notice tone="amber">
          Nothing is saved yet — submitting needs the database, which arrives later in the build. The
          form and its rules are real.
        </Notice>
      ) : null}

      <Field name="title" label="Title" error={errors?.title} counter={{ value: title.length, max: CFG.titleMax }}>
        <input
          id="title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={textInputClass(Boolean(errors?.title))}
        />
      </Field>

      <Field
        name="url"
        label="URL"
        error={errors?.url}
        hint={domain ? <>Will show as <span className="font-semibold text-ink-2">{domain}</span></> : undefined}
      >
        <input
          id="url"
          name="url"
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={textInputClass(Boolean(errors?.url))}
        />
      </Field>

      <OrDivider />

      <Field
        name="text"
        label="Text"
        error={errors?.text}
        hint="For Ask and discussion posts. Same formatting as comments."
      >
        <textarea
          id="text"
          name="text"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={textInputClass(Boolean(errors?.text))}
        />
      </Field>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <PrimaryButton type="submit" disabled={blocked !== null}>
          Submit
        </PrimaryButton>
        <span className="type-meta text-meta">
          {viewerName ? (
            <>
              Submitting as <span className="font-semibold text-ink">{viewerName}</span>.
            </>
          ) : (
            "You need an account to submit."
          )}
        </span>
      </div>
    </form>
  );
}
