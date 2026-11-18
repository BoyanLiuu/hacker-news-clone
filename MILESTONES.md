# Milestones — Tally (hacker-news-clone)

Plan: `../docs/project-idea/28-hacker-news-clone/IMPLEMENTATION_PLAN.md`
Design: `../docs/project-idea/28-hacker-news-clone/impeccable/DESIGN.md` + 36 `ux-*.png` screens
Architecture: `../docs/project-idea/28-hacker-news-clone/ARCHITECTURE.md`

Phase 1 (M0–M6) is static: every screen on fixture data, no database, no API, no sign-in.

| Milestone | Status |
|---|---|
| **M0 — Scaffold and design tokens** | **Done** |
| **M1 — Fixtures and the service boundary** | **Done** |
| **M2 — Listings** | **Done** |
| M3 — Thread and comment tree | Next |
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

---

## M2 — Listings · Done

Surfaces: `ux-1-front`, `ux-8-newest`, `ux-9-past-front`, `ux-10-from-domain`, `ux-30-empty-site`

**Objective.** All four listings render real fixture data on the design's five-track grid, at both
1440 px and 375 px.

**Guidance.**
- `src/components/story-row.tsx` — one row, used unchanged by all four listings. `ux-8` shows
  `/newest` using the same rank-and-points row as `/`, so the row needs **no variants and no boolean
  modes**; a page differs only in the order it passes rows in and which points value it passes.
- `src/components/story-list.tsx` — the ruled list plus `StoryListSkeleton` on the identical grid.
- `src/components/page-shell.tsx` — header, two-column grid, footer. Synchronous, so it prerenders.
- `src/components/{vote-button,datasheet-table,pager,empty-state}.tsx`
- `src/services/viewer.ts` — the second seam: a fixture viewer now, Clerk in M10.
- `src/lib/format.ts` — relative age and pinned-locale counts.
- Pages: `/`, `/newest`, `/from?site=`, `/front/[date]`, and `/past` as a redirect.

**Test requirements.** 2 added, 28 total.

| Test | Bug it catches |
|---|---|
| `formatAge` unit boundaries | "60 min" instead of "1 h", or "48 h" instead of "2 d", in a 52 px column |
| never a negative age | clock skew rendering "-3 min", which looks broken |

**Integrates with.** M1's services for every read, M0's tokens and shell for every surface.

**Demo.** Measured in the browser against the reference screens:

| Checked | Result |
|---|---|
| Grid tracks, 1440 px | `30px 70px 510px 52px 74px`, 12 px gap — head band identical to rows, so nothing shifts |
| Grid tracks, 375 px | `26px 28px 257px`; head band hidden, figures moved into the meta line |
| `/` differs from `/newest` | ranked #1 is 412 pts at 6 h; newest #1 is 18 pts at 1 h |
| Decay holds | #4 (64 pts, 2 h) outranks #6 (236 pts, 8 h) and #7 (302 pts, 12 h) |
| Domain links | 26 on the page; `/from?site=kestrel.systems` lists 4, `blog.kestrel.systems` folds to the same page |
| Empty state | `/from?site=example.com` gives the heading, explanation and Submit action |
| Own items | petrol square instead of the arrow; `edit delete` with no comments, `edit` only once replied |
| Horizontal overflow | none at either width |

**Five findings.**

1. **Suspense boundaries are now required, not optional.** `cacheComponents` is on, so anything
   reading the clock, the viewer or `searchParams` must sit inside a boundary — and `searchParams`
   must be *passed down as a promise* and awaited there, not awaited in the page body. Four separate
   build failures taught this one route at a time. `/past` became a **route handler** rather than a
   page, because a pure redirect has nothing to prerender.
2. **The shell had to be split.** Reading the viewer in `PageShell` made the whole header dynamic.
   The wordmark and nav are the same for everyone and now prerender; the account block and document
   line stream into slots, both fixed-height so nothing shifts.
3. **The front page is 204 KB uncompressed against a 50 KB budget — but 17.2 KB gzipped.** The
   breakdown: 135 KB (66%) is the RSC flight payload, 69 KB is markup, and **41 KB of that markup is
   repeated Tailwind class attributes** across 30 rows. **ARCHITECTURE §6.3 does not say whether the
   budget is wire size or uncompressed, and that needs deciding.** Gzipped it passes comfortably;
   uncompressed it does not. M14 owns the budget, and the repeated class strings are the obvious
   first cut.
4. **Two deviations from the reference, found by comparing screenshots.** The domain was wrapping to
   its own line because title-plus-domain was a flex row — the long title filled the line and pushed
   the domain down. It is inline flow now, so the domain follows the title's last line as `ux-1`
   shows. Separately the generated filler had landed on the **top-ranked** story, so row 1 claimed
   312 comments where the reference shows 42; it now attaches to the oldest story, which ranks low.
5. **`/item`, `/user/*`, `/submit` and `/settings` 404 on prefetch** — 13 console errors on the front
   page. The links are right; the routes arrive in M3 and M5. Expected mid-phase, recorded so it is
   not mistaken for a defect later.

Also fixed while verifying: own items never offered `delete`, and the mobile meta line read
"1 comments".

**Commit.** `feat: Add ranked, newest, past and domain listings` — not committed yet.

### M2 review pass

Reviewed with `code-simplifier` and `vercel-react-best-practices`; rendered output unchanged after.

- **The waterfall came back.** All four pages awaited `searchParams`, then the viewer, then the
  query — the first two are independent. One `Promise.all` each now. The M1 review had already fixed
  this pattern once, which is an argument for the checker enforcing it rather than a reviewer
  catching it each milestone.
- **The head band was duplicated** between `StoryList` and `StoryListSkeleton`. Those two have to
  stay identical or the zero-layout-shift guarantee quietly stops being true, and two copies is how
  that happens. One hoisted `HEAD_BAND` constant now.
- **`toRows()`** replaces four copies of `(page - 1) * pageSize + i + 1`.
- **`titleInk` / `metaInk`** replace six copies of the same dead-row ternary.

Reported and deliberately left for M14: the row renders both the mobile and desktop figures and
hides one with CSS, which doubles that markup across 30 rows and feeds the 41 KB of repeated class
attributes. Fixing it means a CSS-only reflow, which carries visual risk and no functional gain today.

### Out-of-range pages

`/?p=99` rendered an empty list under "Page 99 of 3" with no explanation, while every other dead end
in the app explains itself. `pageOutOfRange()` and `OutOfRange` in `pager.tsx` now give it a message
and a way back, on all three paginated listings. It stays distinct from an empty list, which needs a
different explanation — `/from?site=example.com` still says "Nothing from example.com yet".
