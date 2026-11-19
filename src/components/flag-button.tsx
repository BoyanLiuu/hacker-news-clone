"use client";

import { useActionState } from "react";
import { flagItem } from "@/services/flag-actions";
import type { ItemType } from "@/lib/types";

/**
 * The `flag` affordance, as a real form.
 *
 * One component for all three places that offer it — the listing row, a thread's header, and a
 * comment — because the control is the same control and the only difference is which id it carries.
 *
 * Styled as the meta-line text around it, so the row keeps one voice: DESIGN.md gives flagging a
 * word, not a button. The underline on hover is what marks it as a control, which is also why this
 * replaced a bare `<span>flag</span>` rather than leaving one — an underline that does nothing is
 * worse than no word at all, and until now the word did nothing.
 */
export function FlagButton({
  type,
  id,
  label,
  flagged = false,
}: {
  type: ItemType;
  id: number;
  label: string;
  /**
   * Whether this viewer has already flagged it, read on the server. Not derived from action state:
   * `revalidatePath` remounts this component and resets the hook, so a fact that must outlive the
   * request cannot live in it — the word read "flag" again right after a successful flag.
   */
  flagged?: boolean;
}) {
  const [result, action, pending] = useActionState(flagItem, undefined);

  // Once it is flagged, the word becomes a statement rather than a control: nothing is gained by
  // offering a second flag that the primary key would discard anyway.
  if (flagged || result?.ok) {
    const killed = result?.ok ? result.dead : false;
    return <span className="text-amber">{killed ? "flagged · now dead" : "flagged"}</span>;
  }

  return (
    <form action={action} className="contents">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Flag ${label}`}
        className="underline-offset-2 hover:underline disabled:no-underline"
      >
        {pending ? "flagging…" : "flag"}
      </button>
      {/* The refusal is shown, not swallowed: a flag that silently does nothing is the one failure
          mode worse than an error, because it cannot be told from one that worked. */}
      {result && !result.ok ? (
        <span role="alert" className="text-amber">
          {result.error}
        </span>
      ) : null}
    </form>
  );
}
