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
| **M3 — Thread and comment tree** | **Done** |
| **M4 — Figure 1** | **Done** |
| M5 — Forms, profiles, moderation views, error states | **Partial — 11 of 17 surfaces** |
| M6 — Motion pass | After M5 finishes |

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

**The thread figure** — points and rank since posting, from `ux-4` — is still outstanding. It is a
different chart from this one and did not share the decay geometry, so it is better done alongside
M5's remaining surfaces than bolted onto this milestone.

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

## M5 — Forms, profiles, moderation views and error states · Partial (11 of 17)

**Built.** `/submit` with the live 80-character counter, the three notice tones and the rules aside ·
`/settings` with about and show-dead · `/user/[username]` with the facts table and URL-driven tabs ·
`/admin/flagged` with the queue, Kill/Restore text actions and the moderators-only refusal ·
`error.tsx` · `not-found.tsx` · `notice.tsx`, `field.tsx`, `tabs.tsx`.

**The 13 prefetch 404s on the front page are gone** — they were exactly these routes.

**Still open, and the reason M5 was flagged as overloaded when the plan was reviewed:**

- `ux-12` duplicate submit — `findDuplicate` exists in the service, no UI
- `ux-13` rate-limited state — the limit is stated, the state is not rendered
- `ux-24` stale ranking — the amber document line is wired but `stale` is hardcoded `false`; needs M9's `computedAt`
- `ux-28` own-post delete confirm — the link exists, the red inline confirm does not
- `ux-18` / `ux-21` — new-account and moderator thread variants

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

Every route is now `ƒ`. **ARCHITECTURE Appendix B should record this** — it currently describes the
PPR-shaped architecture.

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

**Commit.** `feat: Add submit, profile, settings and moderation views`
