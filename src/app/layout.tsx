import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SLOW_COOKIE } from "@/services/viewer";
import { chivo, chivoMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "ByteBoard",
  description: "A link aggregator whose front page is a computed ordering, stated as fact.",
};

/**
 * `data-slow` is review tooling driven by `/preview`: it multiplies every stepped transition by 16
 * so a 120 ms two-step animation is reviewable. It sits on `<html>` because that is where the
 * duration variable is overridden, and nothing below has to know about it.
 *
 * `<ClerkProvider>` is deliberately *not* here. It ships Clerk's React SDK to every page beneath
 * it, which cost 132.5 KB gz on every reading path — see `app/(auth)/layout.tsx`, where it now
 * lives. Nothing outside the sign-in and sign-up pages renders a Clerk client component.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const slow = (await cookies()).get(SLOW_COOKIE)?.value === "1";

  return (
    <html lang="en" className={`${chivo.variable} ${chivoMono.variable}`} data-slow={slow ? "" : undefined}>
      <body>
        {children}
      </body>
    </html>
  );
}