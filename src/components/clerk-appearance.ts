import type { ClerkProvider } from "@clerk/nextjs";

type Appearance = NonNullable<React.ComponentProps<typeof ClerkProvider>["appearance"]>;

/**
 * Clerk's prebuilt forms, dressed as Tally's.
 *
 * The design has no account screens of its own — `ux-31-login.png` showed a username and password
 * form from an earlier reading of the brief, and Google OAuth superseded it (Appendix B). So rather
 * than rebuild Clerk's flows, this maps its slots onto the tokens in `globals.css`: 2 px radii, the
 * one petrol hue, and Chivo throughout.
 *
 * `cssLayerName` is what makes any of it take effect. Clerk injects its rules unlayered, and
 * unlayered CSS outranks every cascade layer regardless of order, so Tailwind's `@layer utilities`
 * lost silently: `bg-ink` was on the button and the button was still petrol. Naming the layer moves
 * Clerk into the `@layer clerk` declared at the top of `globals.css`, below all of Tailwind's.
 *
 * `variables` carries the colours Clerk derives *other* colours from, which a flat class override
 * cannot reach: `colorPrimary` here resolves to `--accent: #00646e` and, on the same element,
 * `--accentHover: color-mix(in srgb, #00646e, white 20%)`. `elements` carries the rest.
 */
export const tallyAppearance: Appearance = {
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#00646e",
    colorPrimaryForeground: "#fcfcfa",
    colorBackground: "#fcfcfa",
    colorForeground: "#15171a",
    colorMutedForeground: "#565c63",
    colorBorder: "#d5d9dc",
    colorInput: "#fcfcfa",
    colorInputForeground: "#15171a",
    colorRing: "#00646e",
    colorDanger: "#b3261e",
    borderRadius: "2px",
    fontFamily: "var(--font-chivo), ui-sans-serif, system-ui, sans-serif",
    fontSize: "15px",
  },
  elements: {
    // Structure is drawn with rules, never shadow — DESIGN.md's Rules Not Lift Rule. The shadow and
    // the 4 px radius sit on the outer `cardBox`, not on `card`, so styling `card` alone left both.
    cardBox: "shadow-none border border-rule rounded-hair",
    card: "shadow-none bg-paper",
    headerTitle: "type-title",
    headerSubtitle: "type-meta text-meta",
    formButtonPrimary:
      "bg-ink hover:bg-ink-hover text-paper font-semibold text-[14px] h-9 rounded-hair shadow-none normal-case",
    // `border` as well as `border-field`: moving Clerk down a layer took its border *widths* with
    // it, so a colour-only class left both of these at 0px and the fields drawn as bare baselines.
    formFieldInput: "border border-field rounded-hair focus:border-petrol",
    socialButtonsBlockButton: "border border-field rounded-hair hover:border-field-hover",
    footerActionLink: "text-petrol-ink underline underline-offset-2",
    dividerLine: "bg-rule-2",
    dividerText: "type-meta text-meta",
  },
};
