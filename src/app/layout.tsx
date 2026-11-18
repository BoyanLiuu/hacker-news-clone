import type { Metadata } from "next";
import { chivo, chivoMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tally",
  description: "A link aggregator whose front page is a computed ordering, stated as fact.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${chivo.variable} ${chivoMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
