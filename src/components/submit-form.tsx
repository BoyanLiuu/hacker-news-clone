"use client";

import { useState } from "react";
import { CFG } from "@/lib/config";
import { Field, OrDivider, PrimaryButton, textInputClass } from "./field";
import { Notice } from "./notice";

export const TITLE_MAX = 80;

type Errors = { title?: string; url?: string; text?: string };

/**
 * The submit form. Validation runs here so the counter and the errors are live, and the same rules
 * run again in the Server Action in M12 — the client copy is a courtesy, never the gate.
 *
 * Nothing persists yet: the service throws `NotImplementedInStaticPhase`, so submitting shows what
 * would happen rather than pretending to work.
 */
export function SubmitForm({ viewerName }: { viewerName: string | null }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<Errors | null>(null);

  const count = Object.keys(errors ?? {}).length;

  function validate(event: React.FormEvent) {
    event.preventDefault();
    const found: Errors = {};

    if (!title.trim()) found.title = "Add a title.";
    else if (title.length > TITLE_MAX) found.title = `Shorten the title to ${TITLE_MAX} characters.`;

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

      <Field name="title" label="Title" error={errors?.title} counter={{ value: title.length, max: TITLE_MAX }}>
        <input
          id="title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={textInputClass(Boolean(errors?.title))}
        />
      </Field>

      <Field name="url" label="URL" error={errors?.url}>
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
        <PrimaryButton type="submit">Submit</PrimaryButton>
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

      <p className="mt-4 type-meta text-meta">
        Rate limit: {CFG.ratePerHour} an hour per account, {CFG.ratePerIp} per network.
      </p>
    </form>
  );
}
