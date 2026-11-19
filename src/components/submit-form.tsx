"use client";

import { useActionState, useState } from "react";
import { CFG } from "@/lib/config";
import { registrableDomain } from "@/lib/domain";
import { validateSubmission, type SubmitErrors } from "@/lib/validate";
import { submitPost } from "@/services/post-actions";
import { Field, OrDivider, PrimaryButton, textInputClass } from "./field";
import { Notice } from "./notice";

/**
 * The rate-limited state, formatted on the server. Both strings are read off the clock, so
 * computing them here would hydrate against a different minute than the server rendered.
 */
export type Blocked = { at: string; until: string; used: number };

/**
 * The submit form.
 *
 * Validation runs twice from one source: `validateSubmission` fires here on submit so the errors
 * are immediate, and the action runs the same function because it is reachable without this form
 * ever loading. The client copy is a courtesy, never the gate.
 *
 * `useActionState` keeps it working with JavaScript disabled — React emits a resolvable action id
 * for the form, measured in M11 — so the local pre-check must not swallow the submit. It only
 * blocks when it finds something, and the action re-checks regardless.
 */
export function SubmitForm({
  viewerName,
  blocked,
}: {
  viewerName: string | null;
  blocked: Blocked | null;
}) {
  const [state, action, pending] = useActionState(submitPost, undefined);

  // Seeded from the action's reply, so a rejected submit without JavaScript comes back filled in:
  // the browser has replaced the page by then and the reply is all that is left of the draft.
  const returned = state && "fields" in state ? state.fields : undefined;
  const [title, setTitle] = useState(returned?.title ?? "");
  const [url, setUrl] = useState(returned?.url ?? "");
  const [text, setText] = useState(returned?.text ?? "");
  const [local, setLocal] = useState<SubmitErrors | null>(null);

  const serverErrors = state && "errors" in state ? state.errors : undefined;
  const errors = local ?? serverErrors ?? null;
  const limited = state && "limited" in state ? state.limited : null;
  const count = Object.keys(errors ?? {}).length;
  // Shown under the field as you type, so the listing's byline is not a surprise after submitting.
  const domain = registrableDomain(url.trim());

  /**
   * Checked here before the round trip, and the submit is cancelled only if something is wrong.
   * The same function the action runs, so the two can never disagree about the rules.
   */
  function check(event: React.FormEvent<HTMLFormElement>) {
    const found = validateSubmission({ title, url, text });
    setLocal(Object.keys(found).length > 0 ? found : null);
    if (Object.keys(found).length > 0) event.preventDefault();
  }

  return (
    <form action={action} onSubmit={check} noValidate className="max-w-[640px]">
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

      {limited ? <Notice tone="amber">{limited}</Notice> : null}

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
        <PrimaryButton type="submit" disabled={blocked !== null || pending}>
          {pending ? "Submitting…" : "Submit"}
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
