import { ClerkProvider } from "@clerk/nextjs";
import { byteBoardAppearance } from "@/components/clerk-appearance";

/**
 * `<ClerkProvider>` lives here and not in the root layout, which is M14's largest single saving.
 *
 * The provider pulls Clerk's React SDK into every page that sits under it, and in the root layout
 * that meant every reading path: measured at 313.7 KB gz of first-party JavaScript on `/`, against
 * a 174 KB framework floor. Scoped to the pages that actually render Clerk's own components, `/`
 * ships 181.2 KB — 7.2 KB over the floor. The explicit JS budget that motivated the measurement was
 * withdrawn on 19 Nov 2026 (ARCHITECTURE §2, N10); shipping an auth SDK to pages with no auth UI is
 * still waste, so the scoping stands on its own.
 *
 * `(auth)` is a route group, so the URLs are still `/sign-in`, `/sign-up` and `/account`. What the
 * group actually collects is every page that renders one of Clerk's own components — that, and not
 * "the sign-in pages", is what needs the provider.
 *
 * Nothing outside this group needs it. `auth()` is server-side and reads the request through
 * `clerkMiddleware`, and the header's logout is a Server Action — see `signOut`.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider appearance={byteBoardAppearance}>{children}</ClerkProvider>;
}
