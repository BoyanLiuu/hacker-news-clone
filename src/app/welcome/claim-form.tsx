"use client";

import { useActionState } from "react";
import { Field, PrimaryButton, textInputClass } from "@/components/field";
import { Notice } from "@/components/notice";
import { claimUsername } from "@/services/onboarding";

/**
 * The rules are stated before you type rather than after you fail, and the value you typed survives
 * a rejection — the same contract as `/submit`.
 */
export function ClaimForm() {
  const [result, submit, pending] = useActionState(claimUsername, undefined);

  return (
    <form action={submit} className="max-w-[640px]">
      {result?.error ? <Notice tone="red">{result.error}</Notice> : null}

      <Field
        name="username"
        label="Username"
        error={result?.error}
        hint="3–20 characters: lowercase letters, numbers and underscores. This cannot be changed."
      >
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          className={textInputClass(Boolean(result?.error))}
        />
      </Field>

      <div className="mt-6">
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Claiming…" : "Claim it"}
        </PrimaryButton>
      </div>
    </form>
  );
}
