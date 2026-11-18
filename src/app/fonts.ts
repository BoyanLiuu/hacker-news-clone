import localFont from "next/font/local";

export const chivo = localFont({
  src: [
    { path: "./fonts/chivo-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/chivo-wght-italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-chivo",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

export const chivoMono = localFont({
  src: [{ path: "./fonts/chivo-mono-wght-normal.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-chivo-mono",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});
