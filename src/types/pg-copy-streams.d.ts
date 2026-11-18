// pg-copy-streams ships no type declarations.
//
// The streams it returns are pg `Submittable`s as well as Node streams — that dual nature is how
// `client.query(copyFrom(sql))` works at all, and saying so here is what makes the call typecheck
// without a cast. Only `from` is used; `to` is declared for symmetry.
declare module "pg-copy-streams" {
  import type { Readable, Writable } from "node:stream";
  import type { Submittable } from "pg";

  export function from(sql: string): Writable & Submittable;
  export function to(sql: string): Readable & Submittable;
}
