# Milestones — Tally (hacker-news-clone)

Plan: `../docs/project-idea/28-hacker-news-clone/IMPLEMENTATION_PLAN.md`
Design: `../docs/project-idea/28-hacker-news-clone/impeccable/DESIGN.md` + 36 `ux-*.png` screens
Architecture: `../docs/project-idea/28-hacker-news-clone/ARCHITECTURE.md`

Phase 1 (M0–M6) is static: every screen on fixture data, no database, no API, no sign-in.
Phase 2 begins at M7, which moves the data layer to Postgres without changing a service signature.

| Milestone | Status |
|---|---|
| **M0 — Scaffold and design tokens** | **Done** |
| **M1 — Fixtures and the service boundary** | **Done** |
| **M2 — Listings** | **Done** |
| **M3 — Thread and comment tree** | **Done** |
| **M4 — Figure 1** | **Done** |
| M5 — Forms, profiles, moderation views, error states | **Done — 16 of 17; `ux-24` blocked on M9** |
| M6 — Motion pass | **Done — 4 of 6 CSS items; 2 moved to M15 with their targets** |
| M7 — Supabase and Prisma | **Partial — database live; services still on fixtures** |

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

---

## M3 — Thread and comment tree · Done

Surfaces: `ux-4-thread`, `ux-5-thread-collapsed`, `ux-6-thread-depth-cap`, `ux-7-comment-permalink`,
`ux-33-thread-reply`, `ux-35-deleted-comment`, `ux-29-dead-permalink`

**Objective.** A 334-comment thread renders at the right depths from one document request, the depth
cap is escapable, and comment text can never become markup.

**Guidance.**
- `src/lib/markdown.ts` — paragraphs, `*italics*`, `` `code` ``, two-space-indented blocks,
  autolinked URLs. **Parses to a token tree; the renderer emits React elements.** There is no
  `dangerouslySetInnerHTML` anywhere, so a `<script>` in a comment is text by construction rather
  than by remembering to escape it.
- `src/components/comment-node.tsx` — recursive server rendering, indent spine, depth cap, OP chip,
  own-score-only rule, `[deleted]` handling.
- `src/components/collapse-toggle.tsx` — the one client component, per comment.
- `src/components/{comment-body,post-header,reply-form}.tsx`
- `src/app/item/page.tsx`, `src/app/reply/page.tsx` — thread and comment permalink.
- `globals.css` — the indent spine, `content-visibility` on comment rows, the collapse rule.

**Test requirements.** 9 added, 37 total. The formatter carries most of them because it is the only
place user input becomes output.

| Test | Bug it catches |
|---|---|
| HTML stays text | a stored `<script>` executing for every reader of the thread |
| no non-http scheme linkified | `javascript:` or `data:` becoming a clickable href |
| href equals visible text | a link claiming to go somewhere it does not |
| markers literal inside code | `SELECT *` losing its asterisk, so copied code is wrong |
| indented block kept verbatim | pasted code reflowed as prose |
| lone marker stays text | an unterminated `*` eating the rest of the comment |
| paragraphs split on blank lines | a multi-paragraph comment collapsing into one block |

**Integrates with.** M1's `getThread` and `getSubtree`, which already existed and were tested, so
this milestone was rendering rather than data work. M2's shell, tokens and vote button.

**Demo.** Measured against the reference screens:

| Checked | Result |
|---|---|
| Big thread | 329 articles rendered + 4 behind one depth-cap link = 334 exactly |
| Depth cap | one "continue this thread" link; `/reply?id=44351` resolves and re-roots so the cap restarts |
| Authored thread | 39 comments, 5 OP chips, 28 parent links, own score on 2, code blocks and inline code |
| Deleted comment | `[deleted]` shown, its reply retained |
| XSS probe, end to end | zero `<img>` elements, no executable `<script>`, payload shown escaped, `javascript:` not linkified, `https://` linkified, italics and code correct |
| Collapse | `+10 hidden` matches 10 descendants; vote column, body and replies hidden, header kept; 10 visible descendants → 0; page shorter; scroll unchanged; survives reload; other comments unaffected |

**Four findings.**

1. **A permanent XSS probe is now a fixture.** The plan asks you to paste `<script>` into a comment
   and check it renders as text. That is a one-off, so the generator now emits a probe comment
   carrying the payload plus a `javascript:` URL and an asterisk inside code. The guarantee is
   visible in the running app, not only in unit tests.
2. **The React compiler rejected `setState` in an effect**, correctly: reading `localStorage` on
   mount and setting state cascades renders. `localStorage` is an external store, so the toggle uses
   `useSyncExternalStore` with a server snapshot of "expanded".
3. **The collapse CSS used a child selector and hid almost nothing.** Only the replies wrapper is a
   direct child of the article; the body and vote column sit inside the row's flex wrapper. A
   descendant selector is both correct and simpler, since anything inside a collapsed ancestor is
   hidden by that ancestor anyway. Caught by measuring computed styles, not by looking at it.
4. **An optimisation I was confident about measured worse, twice.** Replacing 330 per-comment client
   components with one delegated controller plus CSS grew the 330-comment thread from **38.7 KB to
   48.9 KB gzipped**; deduping the chevron with `<use>` recovered 0.5 KB of that. A client-component
   reference with two props serialises more compactly than the equivalent server-rendered button
   tree, and gzip already collapses the repetition. Reverted. The untested counter-argument is
   hydration cost — 330 subscriptions rather than one — which nobody has measured, so it is recorded
   rather than acted on.

**Page weights, for M14.** Gzipped: front page 17.2 KB, 39-comment thread 20.7 KB, 334-comment
thread 38.7 KB. Uncompressed the big thread is 1.5 MB, 56% of it RSC payload. The budget question
from M2 — wire size or uncompressed — matters more here than anywhere.

**Deferred to M4.** The thread's own Figure 1, points and rank since posting, which `ux-4` shows in
the aside. It is charting work and belongs with the other figures. Table 1, thread contents, is built.

**Commit.** `feat: Add comment tree with collapse, depth cap and permalinks` — not committed yet.

### M3 review pass — findings recorded, not applied

Reviewed with `code-simplifier` and `vercel-react-best-practices`. Committed as-is; these three are
open.

1. **`countDescendants` runs once per node, which is quadratic in depth.** Measured: 750 node visits
   for the real 334-comment thread (2.2×), but **499,500 for a 1000-comment single chain (500×)**.
   Negligible today and a problem for M14's 1000-comment target, since the depth cap does not bound
   it — the count walks the full subtree regardless. Fix is one post-order pass in `buildTree` so
   each node carries its own count, which also takes the call off the render path.
2. **`preview()` builds two regexes per call** (`item/page.tsx`), twelve rows per thread. Hoist them.
3. **`ReplyForm` uses a fixed `id="reply-text"`.** Correct while one form renders per page; it breaks
   the moment an inline per-comment reply form exists, which is what `ux-33-thread-reply` shows and
   M11 will build — duplicate ids point every label at the first textarea. `useId()` fixes it.

Not defects: `getThread` is called twice per request (page and aside) and deduped by `cache()`, so
M1's caching pays for itself here without anyone thinking about it; and the module-level `snapshot`
in the collapse store is safe because `read()` never runs on the server, where `getServerSnapshot`
is used instead.

---

## M4 — Figure 1 · Done

Surfaces: `ux-23-rank-debug`, `ux-1-front` (the aside), `ux-36-mobile-why-this-order`

**Objective.** A reader can see why the front page is in this order, and tune gravity to watch the
ordering change — with every printed number reproducible by hand.

**Guidance.**
- `src/lib/figure.ts` — the geometry as pure functions: scales, iso-paths, label placement, dot
  sizing, and `px()` rounding. The axes are `log(age + 2) × log(points)`, which is what makes an
  iso-rank line straight with slope proportional to G.
- `src/components/decay-figure.tsx` — server-rendered SVG for the front-page aside. No JavaScript.
- `src/components/decay-figure-live.tsx` — the interactive version: clickable points, highlight,
  readout, gravity slider. **The only Motion in the product.**
- `src/components/rank-debug.tsx`, `src/app/rank-debug/page.tsx` — the per-term table for the top 40.
- Front-page aside now carries Figure 1 above Table 1, with a link to the interactive version.

**Test requirements.** 8 added, 45 total. The figure's geometry is what can be silently wrong while
still looking exactly like a chart.

| Test | Bug it catches |
|---|---|
| iso-line slope ∝ gravity | axes on `log(age)` instead of `log(age + 2)`, destroying the one property the figure teaches |
| iso-line straight across three decades | a line straight only by accident, making "outranks everything below its line" false |
| x ticks keep `age + 2` doubling | ticks tidied to round numbers, so "one tick right" means nothing |
| iso-lines agree with `rank()` at every sampled age | the chart drawing a model the site does not use |
| path stays inside the viewBox | a line drawn off-canvas |
| high and low ranks both emit a path | a line reduced to a stub because every sample exceeded the ceiling |
| points below 1 clamp | a zero-score story running off the chart |

**Integrates with.** M1's `getCandidates`, which already accepted a gravity override — written for
this. M2's front-page aside, where Figure 1 sits above Table 1.

**Demo.** Verified by arithmetic rather than by eye:

| Checked | Result |
|---|---|
| Slope ∝ gravity, in the rendered DOM | slope/G = −0.492, −0.516, −0.516 at G = 0.8, 1.8, 2.8 |
| Ordering responds to gravity | top story at G=0.8 is the 412-point one; at G=2.8 a 64-point, 1.4 h one |
| Table at live gravity | all 40 rows R-descending, every row's `(P−1)/(T+2)^G` reproduces, **every delta zero** |
| Table at G=2.6 | still descending and reproducible; 39 of 40 rows move |
| Front-page figure | server-rendered: 30 filled dots, 41 hollow, no JS needed to read it |
| Phones | figure 343 px wide, stacked below the list, no overflow |

**Five findings.**

1. **A hydration mismatch from floating-point coordinates.** The server rendered
   `cx="71.72177749146155"` and the client computed `71.72177749146152`. The cause was my own
   inconsistency — the static figure rounded with `.toFixed(1)`, the live one emitted raw floats.
   Rounding now happens inside `xOf`/`yOf` via one `px()` helper, which also satisfies
   `rendering-svg-precision`. Sub-pixel precision was invisible anyway.
2. **The printed arithmetic did not evaluate to the printed result.** The readout said
   `R = (412 − 1) / (5.2 + 2)^1.8 = 11.66`, but doing that sum by hand gives 11.77 — because the
   true age was 5.238 while the display rounded to 5.2. For a figure whose entire claim is that the
   ranking is checkable rather than a black box, that is worse than a rounding error.
3. **Fixing that naively put the table visibly out of order.** Sorting on the true score while
   printing the rounded one gave rank 7 an R of 2.844 above rank 8's 2.855. The fix is to round
   **once, at the server boundary**, so a single age value drives the ordering, the arithmetic and
   the figure — and to derive the "vs live" baseline from those same values, so every delta is zero
   at live gravity and the column compares gravities rather than rounding.
4. **`PageShell` always reserved the 336 px aside track**, even with no aside, so `/rank-debug`
   squeezed its table into what was left and every title wrapped to four lines. It now only reserves
   the track when there is an aside — a bug that would have hit every future aside-less page.
5. **Motion has no CSS `steps()` equivalent.** It takes béziers or a custom easing function, so
   DESIGN.md's stepped motion is expressed as `t => Math.ceil(t * 2) / 2` — two discrete jumps over
   120 ms. A spring would make a measuring instrument feel like an app.

Also corrected while here: `@types/node` was at 20 while the runtime is Node 24, which `pnpm peers
check` flagged once Motion was added.

**Deferred, with reasoning.** The design's phone variant opens the figure *inline inside a row* on a
paper inset. That needs a client component per row, which would undo M2's server-rendered listing.
It is also less necessary here than in the prototype: the aside stacks below the list at ≤900 px, so
the figure is already reachable on a phone, and `/rank-debug` gives the interactive version. Recorded
rather than silently skipped.

**The thread figure** — points and rank since posting, from `ux-4` — was deferred here, and again in
M5. It is now **dropped from phase 1**, with the reason recorded in ARCHITECTURE Appendix E: it needs a
vote history, and the only curve phase 1 could draw is `pointsAt`'s back-projection, which would put an
invented history beside measured facts under a caption reading "since posting". Reconsidered in M9,
when the ranking job starts producing real rank-over-time rows.

**Commit.** `feat: Add the decay figure and rank-debug view` — not committed yet.

### M4 review pass

Reviewed with `code-simplifier` and `vercel-react-best-practices`. Output unchanged after.

1. **A comment asserted `next/dynamic` and there was no `next/dynamic` anywhere.** Appendix E requires
   Motion be lazily loaded; I wrote a comment saying it was and never did it. The outcome holds —
   measured, Motion reaches neither `/` nor `/item` — but only because this module is reachable
   solely from `/rank-debug`, so route splitting does the work. The comment now says that, and says
   it was measured. A false comment is worse than a bug: it gets believed.
2. **Motion cost 43 KB gz; now 32 KB.** Importing `m` from `motion/react` pulls the full animation
   bundle even behind `LazyMotion`. `motion/react-m` is the minimal entry and saved **10.8 KB gz**
   (`/rank-debug` 217.7 → 206.9). Verified still interpolating: mid-flight the path differs from both
   endpoints rather than jumping.
3. **~80 lines of chart furniture were duplicated** across the static and interactive figures — grid,
   axes, ticks, labels, hollow dots, in two copies. That is how two renderings of the same chart stop
   being the same chart. Extracted to `figure-frame.tsx`: 182 + 260 lines became 146 + 225 plus a
   60-line shared frame.
4. **`liveOrder.indexOf()` inside a `.map()`** — quadratic over 40 rows. A `Map` now.

**Per-route JS, gzipped:** `/` 174.4 KB · `/item` 175.0 KB · `/rank-debug` 206.9 KB. Motion is +32 KB
on exactly one route and the reading paths are untouched, which is what Appendix E wanted and is now
actually true rather than asserted.

### M5 review pass

Reviewed with `code-simplifier` and `vercel-react-best-practices`. Behaviour unchanged; 404s still
correct; front page still 30 rows and 30 figure dots.

1. **18 dead `await connection()` calls across 12 files.** Under `cacheComponents` they were the
   signal that opted a subtree out of prerendering. With it off every route is dynamic, so they do
   nothing — and the comments beside them explained a mechanism that is no longer running. Removed,
   along with the `next/server` imports.
2. **Nine comments described prerendering that no longer happens** — "the shell prerenders", "the
   header and footer prerenderable", "nothing to prerender". This is the same failure as M4's
   `next/dynamic` comment: documentation asserting a mechanism nobody verified. All nine rewritten to
   describe what the code actually does, which is flush the chrome first and stream the data behind
   boundaries.
3. **The submission-rules table hardcoded `80`** while the validator used `TITLE_MAX`. The table that
   states the rules has to read the constant the rules are enforced with, or it eventually lies.

Not findings: the Suspense boundaries still earn their place with PPR off — they stream the chrome
ahead of the data rather than enabling a static shell. The two "needs an account" notices differ in
tone, content and action, so they are not duplication.

---

## M5 — Forms, profiles, moderation views and error states · Done (16 of 17)

**Built.** `/submit` with the live 80-character counter, the three notice tones and the rules aside ·
`/settings` with about and show-dead · `/user/[username]` with the facts table and URL-driven tabs ·
`/admin/flagged` with the queue, Kill/Restore text actions and the moderators-only refusal ·
`error.tsx` · `not-found.tsx` · `notice.tsx`, `field.tsx`, `tabs.tsx`.

**The 13 prefetch 404s on the front page are gone** — they were exactly these routes.

**The five that were open are now four built and one honestly blocked.**

| Surface | Where it is | Reachable at |
|---|---|---|
| `ux-12` duplicate submit | `item/page.tsx` → `DuplicateNotice` | `/item?id=38214&dup=1` |
| `ux-13` rate-limited | `getSubmitQuota` + `SubmitForm`'s `blocked` | `/submit?limited=1` |
| `ux-28` delete confirm | `delete-confirm.tsx` | `/item?id=38286&confirm=delete` |
| `ux-18` new-account thread | `canFlag` / `canDownvote` gating | `/preview?as=fernhill&to=/item?id=38214` |
| `ux-21` moderator thread | `collapseShadow` + the shadow label | `/preview?as=moss&to=/item?id=38214` |
| `ux-24` stale ranking | **blocked** | needs M9's real `computedAt` |

`ux-24` is the one left, and leaving it is the point: `stale` can only be true if something measured it,
and nothing does until the ranking job runs. A hardcoded amber document line would make the product's one
honest staleness indicator a decoration.

**The enabler was a fixture viewer switch.** Three of those surfaces are states of *who is looking*, and
without a control each one needs a code edit to look at — which means in practice it stops being checked.
`/preview?as=<user>&to=<path>` sets a cookie `getViewer` reads, with a "Preview as" block on `/settings`.
Three guards, because a route that changes who you are is exactly the thing to be careful with: `as` must
match a fixture username (unknown → 400), `to` must be a same-origin absolute path (`//evil.example` and
`https://evil.example` both → `/`), and the route answers 404 under `NODE_ENV=production`. All three
verified. M10 deletes the route, the cookie read and the switcher — harmless over fixtures, privilege
escalation over real sessions — and the plan's M10 now carries that as a checklist item.

**The shadow-ban label is withheld from the banned author.** A moderator seeing an unlabelled row they can
only see because of a ban will reply to it in the open, which tells the author they are banned; an author
shown "shadow-banned" on their own comment learns the same thing directly. So the label is gated on
`isModerator`, not on visibility. Verified in the browser as `quietbit`: own comment visible, no label, no
moderation link.

`collapseShadow` also closed a real gap — a ban applies to everything its author writes, but only rows
flagged individually carried `isShadow`. An unflagged comment by a banned author would have rendered to a
moderator with no label. The one banned fixture author's only comment *is* individually flagged, so no
fixture reaches that branch; it is unit-tested against a constructed row instead.

**Two defects found by looking at it in a browser, neither caught by lint, `tsc` or the build:**

1. **`/submit` rendered a function body where the title limit should be.** `TITLE_MAX` was exported from
   `submit-form.tsx`, which is `"use client"`. A value imported from a client module into a server
   component arrives as a client *reference*, not a number, and interpolating it printed the stub's
   source: `Required, 1–function() { throw new Error("Attempted to call TITLE_MAX()...") } characters`.
   This shipped in M5 and sat there through a review pass. Moved to `CFG.titleMax`, which is where the
   other product constants already were.
2. **The delete confirm was unreadable at 375 px.** Text and buttons on one flex row squeezed the sentence
   into a seven-line ribbon. Column below `sm`, row above. Now two lines, no overflow.

**One measured deviation from the reference PNG.** `ux-28` shows the confirm sentence on one line; mine
wraps to two. The sentence needs 569 px and the band's inner width minus the two buttons leaves 514 px.
Closing a 55 px gap would mean type below the design's 14 px body or buttons below 36 px, both of which
cost more than the wrap does.

**Also cleaned up, under the comment-accuracy rule now in `AGENTS.md`:** `item/page.tsx` and
`reply/page.tsx` each carried two overlapping doc blocks saying the same thing about `notFound()`;
`ThreadAside` claimed the thread figure "lands with the other figures in M4" after M4 had shipped without
it; `reply-form.tsx` and `posts.ts` pointed at M11 for work the plan moved to M12; `vote-button.tsx` had
`VoteButton`'s doc comment sitting above `DownVoteButton`. Three dead imports in the figure components
(`AXES`, `X_TICKS`, `Y_TICKS`, left behind when `figure-frame.tsx` took over the frame) are gone, so lint
is clean with zero warnings rather than five.

**`ReplyForm` takes an `id` prop** (default `reply-text`) ahead of M11's inline per-comment reply boxes,
where two forms sharing one element id would have pointed both labels at the first textarea.

**Verification.** 57 tests across 9 files, `pnpm lint` clean, `tsc --noEmit` clean, `pnpm build` clean,
no console errors or warnings. Production HTML: front page 20.0 KB gz, thread 18.0 KB gz, `/submit`
5.2 KB gz — against the 50 KB budget, and unchanged from the figures recorded for M5 before this work.
Client JS on a thread 177.7 KB gz over 9 files, of which ~174 KB is the framework floor.

**New tests, each naming the bug it catches:**

| Test | Bug it catches |
|---|---|
| `formatUntil` rounds up | a wait shown as shorter than it is, so you retry and are refused again |
| `formatUntil` stays in minutes past an hour | an hours branch that must either round down (lying) or overstate by an hour |
| `formatMinutesLeft` returns null when closed | an expired edit window still offering `edit (0 min left)` |
| `formatUtcClock` is UTC | a local-time deadline printed beside the design's "UTC" label |
| quota counts only this hour | counting a lifetime of posts, locking out anyone with four submissions ever |
| quota's `resetAt` is oldest + 1 h | a fixed cooldown instead of a rolling window — every refresh pushing the deadline away |
| quota is empty when signed out | a limit notice on a page that has no form |
| `collapseShadow` marks a banned author's unflagged row | a moderator replying in the open to content only they can see |
| `collapseShadow` returns the same row when clean | an allocation per row on a 300-comment thread |

**The significant decision: `cacheComponents` is off.**

It was a `create-next-app` default, never a choice, and it fought the requirements in M2 (four build
failures), M4 and M5. The breaking point: under it a page body cannot read request data, so
**`notFound()` can never set a status code** and unknown ids answered 200 — every dead link looking
alive to crawlers and link checkers. ARCHITECTURE §5 already specified the alternative, a dynamic
page over a cached data read, which is what this now is.

| | with `cacheComponents` | without |
|---|---|---|
| `/item?id=99999` | 200 | **404** |
| Front page rows in initial HTML | streamed holes | **30 rows present** |
| Thread, gzipped | 20.7 KB | **18.0 KB** |
| Front page, gzipped | 17.2 KB | 19.9 KB |

Every route is now `ƒ`. **Recorded in ARCHITECTURE Appendix B** as the ninth decision row, with the
measurements above; §5 now also notes that the dynamic page shape is measured rather than assumed.

One documented limitation: a thrown `notFound()` yields Next's minimal error document rather than
`not-found.tsx`, so the status, the noindex and the browser-rendered page are all correct, but a
reader with JavaScript disabled sees a blank 404. Verified in a browser: status 404 and the full
styled page. A wrong status is the worse failure.

**Also removed the root `loading.tsx`** — it applied to every route, so `/submit` and threads got a
ranked-list skeleton. Per-page Suspense fallbacks already cover `ux-25` with the right content.

**`getViewer` now owns the debrief's gating rules** — `isNewAccount`, `canFlag`, `canDownvote`. The
React compiler flagged `Date.now()` during render, and the real fix was recognising these as domain
rules that depend on the clock, not rendering details. It also removed the karma-threshold check I
had duplicated inline in M3.

**Commit.** `feat: Add submit, profile, settings and moderation views` · completion pending commit

### M5 completion review pass

Reviewed with `code-simplifier` and `vercel-react-best-practices`.

1. **Both phase-1 forms submitted to a 404.** The worst finding, and half of it shipped in M3.
   `ReplyForm` and `DeleteConfirm` are plain `<form>`s with no `action`, which the comments described
   as degrading "to a normal POST once the action exists". What a submit actually does is GET the
   current path — which *replaces* the query string, so `id` is dropped: "Add comment" went to
   `/item?text=…` and "Delete post" to `/item`, both `notFound()`. Reachable by anyone clicking the
   button, and `required` on the textarea meant the reply case needed only one word of text.

   Fixed by submitting the id as a hidden field in both, so an early submit returns to the page it
   was typed on — which is also the field M12's action needs. Verified by clicking: "Delete post"
   now lands on `/item?id=38286` with the confirm dismissed.

   Worth naming the class: both comments described the *intended* phase-2 behaviour and read as
   though it were current. That is the `AGENTS.md` rule again, in the one shape it is hardest to
   catch — not a wrong mechanism, a right mechanism that is not wired up yet.

2. **`readQuota` was two reads that could disagree.** `/submit` calls it twice — the form for the
   notice, the aside for the "this hour" row — and the `?limited=1` branch minted its reset time
   from `Date.now()` on each call. Only the form reads `resetAt` today, so nothing was visibly
   wrong, but it is the per-request inconsistency `getViewer` was restructured to remove in M5.
   Wrapped in `cache()`, and the 49-minute fallback (copied off the reference PNG) replaced with
   `HOUR`, which is what a just-filled allowance actually implies.

3. **A comment overstated the rate-limited form.** It said you could "finish writing and submit when
   the slot frees". Submit is disabled from a server-read quota and nothing polls it, so the slot
   freeing changes nothing until the page is loaded again. Reworded to say that.

4. **Two small simplifications.** `encodeURIComponent("/settings")` computed a constant at render;
   written as `%2Fsettings`. `VIEWERS` was declared below the component that reads it, against the
   file-level convention everywhere else here.

Not changed, deliberately: `ReplyForm`'s `elementId` default stays, since M11 is what needs distinct
ids and inventing them now would be speculative; and the disabled Submit keeps `disabled` rather than
`aria-disabled`, because the amber notice carries the explanation a keyboard user needs.

**No test covers the hidden-id invariant.** It needs a component renderer, which this project does not
have, and adding one for a single assertion is not worth it. It is a browser check, listed in the
demo above.

---

## M6 — Motion pass · Done

**Objective.** Every animation the design asks for, done once so the JS budget could be measured in one
go rather than guessed at per milestone.

**Guidance.**
- `src/app/globals.css` — the vote-state rules keyed on `data-vote`, a `tally-pulse` keyframe at 1.4 s to
  55 %, and the existing `step-120` utility now actually used by more than one thing
- `src/components/story-row.tsx` — `VoteState`, the four states' markup, and `canFlag` (see below)
- `src/components/vote-button.tsx` — two class hooks, `vote-pad` and `vote-glyph`, and no state
- `src/components/gravity-slider.tsx` — lifted out of `decay-figure-live.tsx` so the dynamic import works
- `src/components/rank-debug.tsx` — Motion behind `next/dynamic`, with an aspect-ratio placeholder
- `src/app/page.tsx` — `previewVote`, which reads the state from the URL so all four are addressable

**Test requirements.** None added, deliberately. What M6 changes is CSS and where a 31 KB chunk lands —
neither is reachable from a unit test, and a test asserting `previewVote` rejects `?vote=nonsense` would
restate its own `Set`. The verification is measurement and a browser, both below. 57 tests still pass.

**Integrates with.** M11 is the consumer: it changes where `data-vote` comes from (a search param now,
`useOptimistic` then) and touches none of the CSS. That separation is the deliverable.

**Demo.** Measured in a production build:

| Route | Initial JS | Over floor |
|---|---|---|
| `/submit` (floor) | 173.9 KB gz | — |
| `/` | 177.0 KB gz | +3.1 |
| `/item?id=38214` | 177.7 KB gz | +3.8 |
| `/rank-debug` | 173.8 KB gz | Motion on demand |

**Motion is 31.1 KB gz in a chunk no route's initial HTML references** — `/rank-debug` fetches it on
hydration. The four vote states cost **zero** JS and zero HTML: `/?vote=confirmed&row=2` is 19.9 KB gz,
the same as `/`.

**Slow motion, because 120 ms is unreviewable by design.** Two steps over 120 ms is one intermediate
frame held for 60 ms, on a 10 px chevron or a 1 px shadow. That is the doctrine working — instrument
motion, not app motion — and it also means nobody can confirm by eye that the steps are there. So every
stepped duration now reads one variable, `--step-duration`, and `/preview?slow=on` overrides it 16x on
`<html>`: the held frame lasts ~0.8 s and both jumps are obvious. `/preview?slow=off` clears it. Measured
on: chevron 1.92 s holding 45 degrees for ~0.8 s, vote glyph `transparent -> 50% -> petrol` with the
midpoint held ~1 s, skeleton pulse 5.6 s. Phase-1 tooling, 404 in production with the rest of `/preview`,
deleted in M10.

**A declared transition is not an animation — found by trying to watch it.** Computed style said
`0.12s steps(2)` on the glyph, so I recorded the vote states as stepping. Sampling an actual attribute
flip showed two of them snapping instead: `fill: none → petrol` cannot interpolate, because `none` is
not a colour, and the row wash had no `transition-property` declared on the `li` at all. The stroke
stepped over 120 ms while the fill jumped at 0 ms — one glyph playing two animations. Fixed by drawing
the idle triangle `fill="transparent"` (same appearance, interpolatable) and adding `li[data-vote]` to
the transition rule. Re-measured across an attribute flip: `transparent → 50 % → petrol` and
`well → midpoint → cursor`, two discrete jumps in ~120 ms, collapsing to 1e-05 s under reduced motion.

The general lesson, and it is the third time this project has hit this shape: reading a CSS *declaration*
back out of `getComputedStyle` confirms what was written, not what happens. Only sampling across a state
change does.

Doctrine, read out of the DOM rather than asserted: vote glyph and pad `0.12s steps(2)`; collapse chevron
`0.12s steps(2)` on transform; `tally-pulse` 1.4 s with `50% { opacity: 0.55 }`, matching DESIGN.md
exactly where Tailwind's `animate-pulse` had been 2 s to 50 %. The points number has
`transition-duration: 0s` — the score does not tween. Under `prefers-reduced-motion: reduce` every
duration collapses to 1e-05 s **and every state still lands**: glyph still petrol, row still washed,
`saved hh:mm:ss` still there. The lazily-loaded figure still animates — moving gravity to 2.6 changes the
iso-line `d`.

**The states are CSS on one attribute, and that was the design decision.** A client island per row would
have put a component on all thirty rows of the busiest page, against N3 and N10, and M3 had already
measured a delegated controller costing more than it saved. Driving everything from `data-vote` meant the
listing stayed server-rendered, and M11 inherits the presentation for free.

**Two colours are not in DESIGN.md.** It specifies the glyph fill, the dotted count, the saved stamp and
the amber note — not the pad behind the triangle or the row wash, which only the comps show. Rather than
invent tints, the pad extends a stated rule (hover is "a 7 % petrol wash", so pressed is that wash at
15 %) and the row reuses `--color-cursor`, which existed unused for exactly the acted-on row. Rollback
drops petrol: petrol marks a state that stands, and the vote no longer does. Recorded in Appendix E.

**Two of M6's six CSS items moved to M15, not dropped.** The cursor wash, the new-comment wash and the
keyboard dialog entry have no targets yet — `j`/`k` and the `?` dialog are M15, a new comment needs M12 —
and M6's own check ("nothing moves and everything still reaches its final state") cannot be run against a
state nothing can enter. Writing the CSS nine milestones early and hoping is how the stale comments this
project keeps finding get written.

**Found while doing it, worth naming:**

1. **The dev server served stale CSS for two revisions.** Computed styles reported the pad and row
   colours swapped relative to the source. The source was right; Turbopack had not recompiled. I nearly
   "fixed" correct CSS, and would have recorded a passing result from a stale stylesheet. Fetching the
   served `.css` and diffing it against the source is what settled it — worth doing whenever a CSS
   measurement disagrees with the file.
2. **`StoryRow` offered `flag` to accounts that cannot flag.** M5 gated the thread and the post header on
   `canFlag` and missed the listing, so the same new account saw no flag link in a thread and a dead one
   on the front page. Now threaded through `StoryList` from all five listings.
3. **The plan's M6 was wrong about this codebase in three places**, all corrected: a 15 KB reading-path
   budget that predates measuring the 174 KB framework floor and was never reachable; "Motion on `/` and
   `/rank-debug`" when the front page deliberately renders the static figure; and the two CSS items above.
4. **Three dead imports** in `decay-figure.tsx` and `decay-figure-live.tsx` (`AXES`, `X_TICKS`, `Y_TICKS`,
   orphaned when `figure-frame.tsx` took over the frame) — removed in the M5 pass, noted here because they
   were figure code.

**A finding of mine that was wrong, and the correction.** I reported the footer as advertising
`j k move · u vote · x collapse · ?` since M0 while nothing implemented it. It does not: the keys hint is
in the reference comps, and `site-footer.tsx` has only ever rendered `Tally · Ranking details · Settings ·
synthetic sample data`. I read the promise off a PNG and asserted it about the build — the same mistake
as a comment describing a mechanism that is not switched on, made about a screenshot instead of code. The
footer is honest; it is simply missing a design element that correctly waits for M15's keys.

**What the audit it prompted did find:** `Retry`, in the rollback note I had just written, was a
permanently underlined span. In this design an underline means a control, so it looked exactly like a
working link and did nothing — while every other not-yet-wired affordance (`flag`, `edit`, `unvote`) is a
bare span specifically so it makes no promise. `Retry` is now a real link to `?vote=pending`, which is
what retrying does: the row goes back in flight. M11 replaces the href with the action.

### M6 review pass

Reviewed with `code-simplifier` and `vercel-react-best-practices`. Code unchanged; **four comments were
wrong**, which is the whole reason `AGENTS.md` carries that check.

1. **`decay-figure-live.tsx` named the wrong mechanism.** It credited "Next's route splitting" for
   keeping Motion off the reading paths. True before M6, stale after: `rank-debug.tsx` now pulls the
   module with `next/dynamic`, which is why no route's *initial HTML* references it at all. The comment
   would have led the next reader to think the dynamic import was redundant and delete it.
2. **Two comments carried a stale 32 KB.** That figure came from M4; measured now it is 31.1 KB gz.
3. **"The front page costs no JS to read" overclaimed**, twice — in `page.tsx` and in the vote CSS
   header. The front page ships 177.0 KB gz against a 173.9 KB framework floor. What is true is that
   *the figure* costs no JS there, and that the vote states cost nothing at all: `/?vote=confirmed&row=2`
   is the same 19.9 KB of HTML as `/`. Both now say that, with the numbers.

Checked and left alone: `motion-reduce:animate-none` on the skeleton bar is redundant with the global
reduced-motion rule, but it stops an *infinite* animation dead rather than running it once at 0.01 ms,
and saying it at the point of use is clearer than relying on a rule 80 lines away.

The root layout reads a cookie now, so every route is `ƒ` — which they already all were, so no route
changed shape. Confirmed in the build output.

**Commit.** `feat: Add stepped motion per the design doctrine`

---

## M7 — Supabase and Prisma · Partial (database live, services still on fixtures)

**Objective.** Move the data layer to Postgres behind the service boundary Appendix C defines, so the
screens built in phase 1 keep working with their implementations swapped underneath.

**Guidance.**
- `prisma/schema.prisma` — Appendix D's models, plus the relation fields it omits (Prisma needs them to
  express a join, and every read wants an author's username) and `isShadow`, which the code has had
  since M5. Appendix D now records that field too.
- `prisma/migrations/20261118095214_init/` — generated offline with `migrate diff --from-empty`, so the
  SQL existed and was reviewable before any database did. RLS is in the same migration, not a follow-up,
  so the tables are never briefly readable.
- `prisma.config.ts` — `DIRECT_URL`, the session pooler, for migrate only.
- `src/lib/db.ts` — `DATABASE_URL` through the `PrismaPg` adapter, with a bounded pool.
- `scripts/verify-rls.mjs` + `pnpm verify:rls` — asks Postgres, not the migration.

**Test requirements.** 4 new tests, 61 total. The schema ones assert invariants that nothing else in
the build would catch:

| Test | Bug it catches |
|---|---|
| RLS on every model | a table added in M11 or M13 shipping world-readable |
| no `url` in the datasource block | a Prisma 7 rejection "fixed" by downgrading Prisma |
| `@@index([postId, path])` present | §6.2's one thread query degrading to a sequential scan |
| connection strings absent from the schema | the same, from the other direction |

**Integrates with.** Nothing above `src/services/` yet — that is the remaining half of the milestone.

**Demo.** `pnpm db:deploy` applied the migration over the session pooler. `pnpm verify:rls`:

| | |
|---|---|
| managed tables | 7 |
| RLS enabled on all | true |
| policy-free on all | true |
| `_prisma_migrations` | correctly skipped — migrate must read and write it |

**Three traps, two of them other people's and one of my own making:**

1. **`prisma@latest` is a release candidate.** `npm view prisma dist-tags` gives `latest: 8.0.0-rc.34`
   and `prev: 7.10.1`. The plan warned about exactly this; pinned to 7.10.1 exactly, not a caret.
2. **`postinstall` would have broken every fresh clone.** Prisma's documented `env()` helper resolves
   eagerly and throws when the variable is missing, so `prisma generate` failed with no `.env` — and
   `generate` is the postinstall, so `pnpm install` failed too. But reading `process.env` directly does
   not work either, because Prisma evaluates the config file *before* loading `.env`, so every migrate
   command then reports "datasource.url property is required". Resolved with Node's built-in
   `process.loadEnvFile()` in a try/catch: `generate` works with no `.env`, and the migrate commands are
   the ones that complain, which is when the URL is actually needed.
3. **pnpm blocks Prisma's install scripts**, which is how it fetches the query engine. Allowlisted
   `prisma` and `@prisma/engines` by name in `pnpm-workspace.yaml` rather than disabling the check.

**The transaction pooler has never been reached, and that is now a recorded gap rather than a surprise
for deployment day.** Port 6543 times out from this network while 5432 is open — verified with `nc`, and
independently hit by a sibling project on the same pooler. So `DATABASE_URL` points at the *session*
pooler locally, which is the one line of `.env` that differs from production. `.env.example` spells out
both ports and which to switch.

**That same sibling project supplied a bug I had already written.** `src/lib/db.ts` had no pool cap, so
`pg` would have used its default of 10 — against a session pooler that allows **15 clients for the whole
project**, while Next runs several render workers each holding its own pool. The constraint is
`workers x max < 15`, not `max < 15`, and exceeding it fails every query with `(EMAXCONNSESSION)` while
the app still renders its shell with all the data missing — so it reads as a UI bug. Now
`DATABASE_POOL_MAX ?? 3`, with 6 for the transaction pooler when deployed. The numbers are measured
there, not guessed: 6 still exhausted it and 2 did not.

**Credential handling.** `.env` is gitignored and untracked, verified before anything was written to it.
`.env.example` is the only committed env file and was diffed against the real `.env` to confirm the
project ref, password and host do not appear in it.

### M7 review pass (partial)

Reviewed with `code-simplifier` and `vercel-react-best-practices`. Three findings, all fixed:

1. **The Prisma CLI was in `dependencies`.** It is a build-time tool; the runtime closure does not need
   the CLI or its engines. Moved to `devDependencies`.
2. **`prisma.config.ts` named a seed script that does not exist.** `prisma db seed` would have failed on
   a missing module, which reads as a broken setup rather than as M8's work not being done yet. Removed.
3. `join(import.meta.dirname, ".")` — the `"."` did nothing.

**Still to do in M7:** reimplement `src/services/*` over Prisma with signatures unchanged, hand-insert a
reply to confirm `path` and `depth`, run the boundary check (stash the services back to fixtures and the
UI should be identical), then delete `src/fixtures/`.

**Commit.** `feat: Add the Prisma schema, migration and Supabase wiring`
