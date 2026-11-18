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
 * Only four `variables` survive: Clerk 7 renamed most of the colour tokens, and rather than guess
 * at the new names the rest is done through `elements`, where the classes are this project's own
 * and cannot drift with Clerk's vocabulary.
 */
export const tallyAppearance: Appearance = {
  variables: {
    colorPrimary: "#00646e",
    colorBackground: "#fcfcfa",
    colorDanger: "#b3261e",
    borderRadius: "2px",
    fontFamily: "var(--font-chivo), ui-sans-serif, system-ui, sans-serif",
    fontSize: "15px",
  },
  elements: {
    // Structure is drawn with rules, never shadow — DESIGN.md's Rules Not Lift Rule.
    card: "shadow-none border border-rule rounded-hair bg-paper",
    headerTitle: "type-title",
    headerSubtitle: "type-meta text-meta",
    formButtonPrimary:
      "bg-ink hover:bg-ink-hover text-paper font-semibold text-[14px] h-9 rounded-hair shadow-none normal-case",
    formFieldInput: "border-field rounded-hair focus:border-petrol",
    socialButtonsBlockButton: "border-field rounded-hair hover:border-field-hover",
    footerActionLink: "text-petrol-ink underline underline-offset-2",
    dividerLine: "bg-rule-2",
    dividerText: "type-meta text-meta",
  },
};
