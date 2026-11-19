import { ClerkProvider } from "@clerk/nextjs";
import { byteBoardAppearance } from "@/components/clerk-appearance";

/**
 * `<ClerkProvider>` lives here, not in the root layout, because it pulls Clerk's React SDK into
 * every page beneath it: `/` measured 313.7 KB gz of first-party JavaScript against a 174 KB
 * framework floor, and 181.2 KB once scoped here.
 *
 * `(auth)` is a route group, so the URLs are unchanged. What it collects is every page rendering a
 * Clerk component — not "the sign-in pages". Nothing outside needs the provider: `auth()` is
 * server-side, and the header's logout is a Server Action (see `signOut`).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider appearance={byteBoardAppearance}>{children}</ClerkProvider>;
}
