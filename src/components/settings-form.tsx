"use client";

import { useActionState } from "react";
import { CFG } from "@/lib/config";
import { saveProfile } from "@/services/profile-actions";
import { Field, PrimaryButton, textInputClass } from "./field";
import { Notice } from "./notice";

/**
 * About text and the show-dead preference.
 *
 * Extracted from `settings/page.tsx` in M13 for one reason: the Save button had never been wired
 * to anything, so the page looked like it worked and silently discarded every change. No milestone
 * owned `updateProfile` — M5 listed the page, nothing listed the action.
 *
 * Email and password are not here. Clerk owns identity from M10, and duplicating them would give
 * two owners for one piece of state.
 */
export function SettingsForm({
  about,
  showDead,
  isNewAccount,
  accountAgeDays,
}: {
  about: string;
  showDead: boolean;
  isNewAccount: boolean;
  accountAgeDays: number;
}) {
  const [state, action, pending] = useActionState(saveProfile, undefined);

  return (
    <form action={action} className="max-w-[640px]">
      {isNewAccount ? (
        <Notice tone="amber">
          New accounts cannot flag or downvote. Yours is {accountAgeDays} day
          {accountAgeDays === 1 ? "" : "s"} old; both unlock at {CFG.flagMinDays} days and{" "}
          {CFG.flagMinKarma} karma.
        </Notice>
      ) : null}

      {state && "saved" in state ? <Notice tone="info">Saved.</Notice> : null}
      {state && "error" in state ? <Notice tone="red">{state.error}</Notice> : null}

      <Field name="about" label="About" hint="Shown on your profile. Same formatting as comments.">
        <textarea id="about" name="about" rows={4} defaultValue={about} className={textInputClass(false)} />
      </Field>

      <div className="mt-6">
        <label className="flex items-start gap-3 text-[15px]">
          <input
            type="checkbox"
            name="showDead"
            defaultChecked={showDead}
            className="mt-[3px] size-4 accent-petrol"
          />
          <span>
            Show dead posts
            <span className="mt-1 block type-meta text-meta">
              Flagged items stay out of listings by default. They are always readable at their own link.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-7">
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>
    </form>
  );
}
