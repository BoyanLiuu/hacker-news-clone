import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { tallyAppearance } from "@/components/clerk-appearance";
import { SLOW_COOKIE } from "@/services/viewer";
import { chivo, chivoMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tally",
  description: "A link aggregator whose front page is a computed ordering, stated as fact.",
};

/**
 * `data-slow` is review tooling driven by `/preview`: it multiplies every stepped transition by 16
 * so a 120 ms two-step animation is reviewable. It sits on `<html>` because that is where the
 * duration variable is overridden, and nothing below has to know about it.
 *
 * `appearance` is on the provider rather than on each `<SignIn/>` because `cssLayerName` is a global
 * option — Clerk types it on `Appearance`, not on the per-component `Theme`, and there is one
 * injection of Clerk's stylesheet to put in a layer, not one per component.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const slow = (await cookies()).get(SLOW_COOKIE)?.value === "1";

  return (
    <html lang="en" className={`${chivo.variable} ${chivoMono.variable}`} data-slow={slow ? "" : undefined}>
      <body>
        <ClerkProvider appearance={tallyAppearance}>{children}</ClerkProvider>
      </body>
    </html>
  );
}