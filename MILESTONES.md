# Milestones — Tally (hacker-news-clone)

Plan: `../docs/project-idea/28-hacker-news-clone/IMPLEMENTATION_PLAN.md`
Design: `../docs/project-idea/28-hacker-news-clone/impeccable/DESIGN.md` + 36 `ux-*.png` screens
Architecture: `../docs/project-idea/28-hacker-news-clone/ARCHITECTURE.md`

Phase 1 (M0–M6) is static: every screen on fixture data, no database, no API, no sign-in.

| Milestone | Status |
|---|---|
| **M0 — Scaffold and design tokens** | **Done** |
| **M1 — Fixtures and the service boundary** | **Done** |
| M2 — Listings | Next |
| M3 — Thread and comment tree | |
| M4 — Figure 1 | |
| M5 — Forms, profiles, moderation views, error states | |
| M6 — Motion pass | |

---

## M0 — Scaffold and design tokens · Done

**Objective.** The app shell renders in Tally's own type and rules, on the design's two-column grid, at
both 1280 px and 375 px.

**Guidance.** Next 16.4.6 · React 19.3 · Tailwind 4.3.3 (CSS-first, no `tailwind.config.js`) · TypeScript
strict · pnpm 12.21 via corepack.
- `src/app/globals.css` — the Tally palette, type scale, radii, the three line weights, and the
  `page-grid` / `page-aside` utilities carrying the design's own 1100/900 breakpoints
- `src/app/fonts.ts` — Chivo and Chivo Mono self-hosted from `src/app/fonts/*.woff2` via `next/font/local`
- `src/components/site-header.tsx` — 52 px petrol-tint title block, authored wordmark, nav, account block,
  and the 30 px mono document line
- `src/components/site-footer.tsx` — footer rule and the synthetic-data note
- `src/app/page.tsx` — the two-column grid with the list head band and aside heading in place

**Test requirements.** None yet; M0 adds no logic. Verified by measurement in the browser instead — see
Demo. The first unit tests land in M1 with `rank.ts`, `tree.ts` and `domain.ts`.

**Integrates with.** Nothing yet — this is the entry point. `page.tsx` composes the header and footer and
is what M2 replaces with real rows.

**Demo.** `pnpm dev`, then measured in the browser:

| Checked | 1280 px | 375 px |
|---|---|---|
| Title block height | 53 px (52 + 1 px rule) | 53 px |
| Active nav underline on the band's bottom edge | gap 0 | gap 0, on its own 40 px row |
| Document line | 30 px, one row | 30 px, one row, 11 px mono |
| Grid | 792 + 336, 48 px gap, aside sticky at 20 px | single column, head band hidden |
| Horizontal overflow | none | none |

Front page HTML 24.7 KB against a 50 KB budget. Zero CDN font requests. `pnpm lint`, `tsc --noEmit` and
`pnpm build` all pass with no console errors or warnings.

**Two failures found and fixed during the check**, both at 375 px: the nav disappeared entirely because the
account block pushed it out of the band, and the document line wrapped to three rows. `DESIGN.md` specifies
the nav moves to a horizontally scrolling 40 px second row on phones, which I had not implemented. The
document line now scrolls rather than wraps, so it holds its 30 px height.

**Commit.** `chore: Scaffold app with Tally design tokens and shell` — not committed yet.

---

## M1 — Fixtures and the service boundary · Done

**Objective.** Every screen that follows can read posts, comments and users through signatures that
will not change when Postgres arrives in M7.

**Guidance.**
- `scripts/gen-fixtures.cjs` (`pnpm gen:fixtures`) — extracts the approved prototype's `P`, `C` and
  `USERS` literals and emits typed modules. The data is lifted, not retyped, so the screens in M2–M5
  match their reference PNGs instead of drifting.
- `src/fixtures/{posts,comments,users}.ts` — 69 posts, 14 users, 391 comments. **Comments are flat rows
  carrying `path` and `depth`**, exactly as Postgres will return them, so M7 swaps a body and no shape.
- `src/fixtures/index.ts` — maps raw rows to models at load; relative ages become timestamps so the
  ranking and the age column stay alive while you work.
- `src/lib/{types,config,rank,path,tree,domain}.ts` — the contract, the constants, the decay function,
  zero-padded ancestry, single-pass tree assembly, registrable-domain extraction.
- `src/services/{posts,comments,users,visibility}.ts` — all `async`, all taking `ViewerOpts`.
  Visibility (dead, deleted, shadow-banned) is written here so M7 inherits it.
- Mutations declared, throwing `NotImplementedInStaticPhase`.

**Test requirements.** 26 tests across 4 files, each naming the bug it catches.

| Test | Bug it catches |
|---|---|
| `rank` at hand-computed inputs | a sign or precedence slip silently reordering the front page |
| gravity sharpens decay | gravity wired as a multiplier, so tuning it does nothing |
| `isCandidate` window edges | an off-by-one letting the whole table into the front-page sort |
| future-dated posts excluded | a negative age inflating the score above everything |
| subtree with an absent parent | an orphaned comment dropping a live subtree from the render |
| siblings sort within their parent | sorting across parents interleaving unrelated branches |
| score ties break by oldest | an unstable sort reshuffling a thread on every reload |
| path padding | comment 10 sorting before comment 9, reordering every thread |
| `bbc.co.uk` not `co.uk` | unrelated sites merged onto one `/from` page |
| dead post hidden in listings, live at permalink | a flag doing nothing, or breaking existing links |
| shadow-banned comment visibility | content leaking to signed-out readers, defeating the ban |
| deleted comment retained in tree | filtering it out and orphaning its replies |

**Integrates with.** M0's shell. `/m1` composes the services; `src/app/page.tsx` is untouched and is
what M2 replaces with real rows.

**Demo.** `/m1`, deliberately unstyled:
- 68 of 69 posts are candidates — the dead one is filtered for a signed-out reader
- ranked page 1 returns 30 of 68 with `hasNext`, scores falling monotonically
- ranking diverges from recency: ranked #1 is 5.2 h old, newest #1 is 0.6 h, different posts
- the debrief's case holds: a 1.4 h / 64-point post outranks an 11.2 h / 302-point post
- thread 38214 returns 311 rows, assembling to 36 roots, deepest depth 12 against a cap of 8
- the depth-8 permalink resolves with 8 ancestors

**Three findings.**

1. **The plan's check could not be met as written.** It calls for a 300-comment thread; the authored
   data tops out at 45. The generator now adds ~270 clearly-labelled filler comments to one thread,
   keeping the 123 authored ones for design fidelity.
2. **The first generated thread was upside down** — 120 comments at depth 12, 12 at depth 0. Real
   threads are top-heavy, and M3 renders against this. Fan-out now decays with depth: 36 roots,
   peaking at depth 2–3, with one deliberate chain to depth 12 so "continue this thread" has a target.
3. **Next 16 will not prerender a page that reads `now()`**, and the ranking is a function of `now()`.
   `cacheComponents` is on in this scaffold, so `dynamic = "force-dynamic"` is rejected outright; the
   fix is a static shell with the request-time read behind `Suspense` plus `await connection()`.
   **M2's real front page needs this same shape, with the skeleton rows as its fallback**
   (`ux-25-loading`) — which is what DESIGN.md's skeleton-on-the-live-grid rule already asks for.

Also dropped two dev dependencies: Vite resolves tsconfig paths natively, so `vite-tsconfig-paths`
and `@vitejs/plugin-react` are gone.

**Commit.** `feat: Add typed fixtures and the service boundary` — not committed yet.

### M1 review pass

Reviewed with `code-simplifier` and `vercel-react-best-practices`. Eight findings, all applied; the
`/m1` output is identical afterwards, which is the check that matters for a refactor.

- **Waterfall removed.** Seven independent reads in `/m1` ran sequentially; they now share one
  `Promise.all`, with only the dependent permalink read after it (`async-parallel`). ARCHITECTURE §5
  already specified this for the thread page, so the code had been contradicting its own design.
- **`React.cache()` on the expensive reads** (`server-cache-react`), which ARCHITECTURE §5 calls for.
  It also fixes real duplicate work: `/m1` was computing the ranking twice, and `getThread` now
  assembles the rows `getThreadRows` already returned instead of filtering and sorting 391 comments
  a second time.
- **`findUser` no longer scans.** It ran two linear scans over 69 posts and 391 comments on every
  miss, and visibility calls it for every post and every comment. Unknown names are now one `Set`
  lookup and derived profiles are memoised.
- **`votes.ts` and `flags.ts` split out of `users.ts`**, matching ARCHITECTURE Appendix F — voting
  and moderation were never user operations.
- **One `listNewest` helper** replaces three copies of "visible posts, newest first".
- `CFG.dupDays * DAY` instead of an inline `3600_000`.
- `maxDepth` walks instead of allocating a flattened copy; `/m1` calls it three times.
- `ANONYMOUS` is frozen, and karma uses a pinned `en-US` formatter rather than the server's locale.

No measurable speed change at this data size — 311 comments and 69 posts are too small to show it.
The fixes are structural: this is the layer M14 has to reach 200 ms p95 through, and M2 and M3 copy
these shapes.
