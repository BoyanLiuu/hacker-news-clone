# Milestones — Tally (hacker-news-clone)

Plan: `../docs/project-idea/28-hacker-news-clone/IMPLEMENTATION_PLAN.md`
Design: `../docs/project-idea/28-hacker-news-clone/impeccable/DESIGN.md` + 36 `ux-*.png` screens
Architecture: `../docs/project-idea/28-hacker-news-clone/ARCHITECTURE.md`

Phase 1 (M0–M6) is static: every screen on fixture data, no database, no API, no sign-in.

| Milestone | Status |
|---|---|
| **M0 — Scaffold and design tokens** | **Done** |
| M1 — Fixtures and the service boundary | Next |
| M2 — Listings | |
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
