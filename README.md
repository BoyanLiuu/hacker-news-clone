This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## The ranking job, measured

M9's instruction was to compare both shapes at real data size and keep the one the numbers justify,
rather than materialising on faith. Against **1 380 stories, 977 inside the 7-day window**:

### The two plans

| | Statement | DB execution | Plan |
|---|---|---|---|
| Inline | score and sort in SQL, `LIMIT 30` | 23.25 ms | Seq Scan + top-N heapsort |
| Materialised | index scan on `RankedPost(score DESC)` | **0.255 ms** | Index Scan |

```
-- inline
Limit  (actual time=21.9..22.0 rows=30)
  ->  Sort  Sort Method: top-N heapsort  Memory: 28kB
        ->  Nested Loop  (actual rows=977)
              ->  Seq Scan on "Post"  Rows Removed by Filter: 403
Execution Time: 22.382 ms

-- materialised
Limit  (actual time=0.017..0.038 rows=30)
  ->  Index Scan using "RankedPost_score_idx"  Buffers: shared hit=22
Execution Time: 0.058 ms
```

`EXTRACT`-based scoring in SQL agrees with `lib/rank.ts` to three decimals, which matters because
Figure 1 and `/rank-debug` draw from the TypeScript function — a disagreement would put a chart on
screen contradicting the order beneath it.

### Why materialised won, and it is not the 91x

A round trip to Supabase is ~105 ms. The query inside it costs 0.26 ms. So **the 91x reduction in
database work is worth about 20 ms of a 135 ms request**, and read speed is the third reason this
shape was kept, not the first.

The first is honesty. `RankedPost.computedAt` is the only real source for the staleness indicator
(`ux-24`). Inline scoring is always `now()` by construction and therefore can never be stale — which
sounds like a feature and is actually the absence of a measurement. M5 shipped that indicator
hardcoded to `false` rather than invent a value; M9 is what finally supplies one.

The second is scaling: the inline sort grows with the window, an index scan does not.

### The actual bottleneck was somewhere else entirely

Materialising made the page **slower** at first — 320 ms against inline's 237 ms. The cause was not
the query:

| Prisma `relationLoadStrategy` | Statements | Time |
|---|---|---|
| `query` (the default) | 3 | 320 ms |
| `join` | **1** | **114 ms** |

Prisma's default issues one statement per relation level, sequentially. `RankedPost → Post → User`
is three statements, each paying a full round trip to do a fraction of a millisecond of work. Three
trivial queries cost 105 ms in `Promise.all` and 316 ms sequentially, which is the whole story.

Setting `relationLoadStrategy: "join"` across every read that joins an author:

| Route | Before | After |
|---|---|---|
| `/newest` | 340 ms | **250 ms** |
| `/item` (400 comments) | 630 ms | **510 ms** |
| `/` | 570 ms | 570 ms |

`/` did not move, and that is the remaining finding: its cost is the **figure**, not the ranking. The
chart plots every candidate by design, so it reads 977 full rows where the list reads 30. After M9
the list is no longer the expensive half of that page.
