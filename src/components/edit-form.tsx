"use client";

import { useActionState, useState } from "react";
import { CFG } from "@/lib/config";
import { validateEdit, type SubmitErrors } from "@/lib/validate";
import { editPost } from "@/services/post-actions";
import { Field, PrimaryButton, textInputClass } from "./field";
import { Notice } from "./notice";

/**
 * Editing a post: title and text, never the URL.
 *
 * The URL is shown read-only rather than omitted, because a submitter looking at this screen needs
 * to see what they cannot change and why. Appendix A fixes it: the URL is what duplicate detection
 * matched on and what every reader already followed, so editing it would rewrite what other people
 * voted for.
 */
export function EditForm({
  postId,
  title: initialTitle,
  url,
  text: initialText,
  closesIn,
}: {
  postId: number;
  title: string;
  url: string | null;
  text: string | null;
  closesIn: string;
}) {
  const [state, action, pending] = useActionState(editPost, undefined);

  const returned = state && "fields" in state ? state.fields : undefined;
  const [title, setTitle] = useState(returned?.title ?? initialTitle);
  const [text, setText] = useState(returned?.text ?? (initialText ?? ""));

  const [local, setLocal] = useState<SubmitErrors | null>(null);
  const errors = local ?? (state && "errors" in state ? state.errors : undefined);

  /** The same function the action runs, so the two cannot disagree about an edit's rules. */
  function check(event: React.FormEvent<HTMLFormElement>) {
    const found = validateEdit({ title, text, hasUrl: url !== null });
    setLocal(Object.keys(found).length > 0 ? found : null);
    if (Object.keys(found).length > 0) event.preventDefault();
  }

  return (
    <form action={action} onSubmit={check} noValidate className="max-w-[640px]">
      <input type="hidden" name="id" value={postId} />
      {/* The action ignores this and reads the stored URL; it rides along so the shared validator
          sees the post as it will be, not as a text post with an empty url field. */}
      <input type="hidden" name="url" value={url ?? ""} />

      <Notice tone="amber">
        Title and text only — the URL is fixed. Editing closes {closesIn}.
      </Notice>

      {errors?.title ? <Notice tone="red">{errors.title}</Notice> : null}

      <Field name="title" label="Title" error={errors?.title} counter={{ value: title.length, max: CFG.titleMax }}>
        <input
          id="title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={textInputClass(Boolean(errors?.title))}
        />
      </Field>

      {url ? (
        <Field name="url-display" label="URL" hint="Fixed once submitted.">
          <input id="url-display" value={url} readOnly disabled className={textInputClass(false)} />
        </Field>
      ) : null}

      <Field name="text" label="Text" error={errors?.text} hint="Same formatting as comments.">
        <textarea
          id="text"
          name="text"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={textInputClass(Boolean(errors?.text))}
        />
      </Field>

      <div className="mt-6">
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </PrimaryButton>
      </div>
    </form>
  );
}
