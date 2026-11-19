<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Conventions for this repo

Added below the generated block so `next dev` does not overwrite them.

### Every comment must describe a mechanism that is switched on

The most valuable finding in two consecutive review passes (M4, M5) was a comment that confidently
described behaviour the code did not have: one named `next/dynamic` in a file that never imported it,
and nine described prerendering after `cacheComponents` had been turned off. Both times the code was
correct and the explanation was wrong — which is worse than no comment, because the next reader trusts
it and reasons from it.

So when reviewing or writing here, check each comment against the thing it claims:

- Does the named API appear in the file? `grep` for it.
- Is the named config flag actually set? `next.config.ts` is the authority, not memory of a past state.
- Does the described sequence match the code's order of operations?

Delete the comment when the mechanism is gone. Do not reword it to be vaguer.

### `cacheComponents` is off, deliberately

`next.config.ts` sets neither `cacheComponents` nor `partialPrefetching`. Turning it on makes
`notFound()` unable to set a 404 status and pushes content out of the initial HTML, which the
architecture's budgets (ARCHITECTURE §6.3) treat as the thing being optimised. Appendix B records the
decision and the measurement.

Consequence for new code: `connection()` is not needed to read request data, and a page that reads the
clock does not need a Suspense boundary to prerender. Do not add either by reflex.

### Reads run in parallel

A page that awaits several independent service calls must start them together. The M1 review removed a
sequential waterfall; the M2 work reintroduced it. `Promise.all` by default, and a sequential `await`
only where the second call genuinely needs the first call's result.

### Comment and post bodies never touch `dangerouslySetInnerHTML`

`src/lib/markdown.ts` parses to a token tree that renders as React elements. This is what makes XSS
safety structural rather than a matter of remembering to escape. The fixtures carry a permanent XSS
probe comment so the property stays tested.

### Claims about size are measured, not estimated

Both JS and HTML budgets in the architecture are stated as measured-over-the-wire numbers, because an
estimate was wrong by 11x once already. A refactor that claims to shrink the bundle states the before
and after from a real build. Two such refactors in M3 measured *worse* than the code they replaced and
were reverted.

### A non-component export from a `"use client"` module is a client *reference*

Calling one on the server throws `Attempted to call X() from the server`, and nothing catches it
first: `tsc`, `eslint` and `next build` all pass, because the failure is a runtime one. M5 lost a
page to it when `TITLE_MAX` came from a client module and rendered as the stub's source text. M11
lost *every listing* to it when `story-row.tsx` gained `"use client"` and took the pure `toRows()`
helper with it — the front page served 30 skeleton bars and a clean build.

So when a component becomes `"use client"`, move its non-component exports out first. Types are
fine; values and functions are not. `src/lib/rows.ts` exists for exactly this reason.

And verify a listing by counting rows in the served HTML, not by reading the build log:

    curl -s localhost:PORT/ | grep -c '<li class="grid'
