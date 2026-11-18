/**
 * Materialised comment ancestry. `parentId` is the truth; `path` is the index.
 *
 * Each segment is an id zero-padded to PAD digits, joined by ".". The padding is what makes
 * lexicographic sort equal numeric sort, so `ORDER BY path` is depth-first display order — drop it
 * and comment 10 sorts before comment 9, which silently reorders every thread.
 *
 * See ARCHITECTURE §6.2.
 */

/** int4 max is 2 147 483 647 — ten digits covers every id Postgres can issue. */
export const PAD = 10;

export function segment(id: number): string {
  return String(id).padStart(PAD, "0");
}

export function childPath(parentPath: string | null, id: number): string {
  return parentPath ? `${parentPath}.${segment(id)}` : segment(id);
}

export function depthOf(path: string): number {
  return path.split(".").length - 1;
}

/** Ancestor ids, root first, excluding the comment itself — the permalink breadcrumb. */
export function ancestorIds(path: string): number[] {
  return path.split(".").slice(0, -1).map(Number);
}

/** True when `path` is `ancestor` or sits beneath it. The fixture form of `path <@ ancestor`. */
export function isAtOrBeneath(path: string, ancestor: string): boolean {
  return path === ancestor || path.startsWith(`${ancestor}.`);
}
