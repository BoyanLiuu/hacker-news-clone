import { cookies } from "next/headers";
import { users } from "@/fixtures";
import { PREVIEW_COOKIE, SIGNED_OUT } from "@/services/viewer";

/**
 * The fixture viewer switch: `/preview?as=fernhill&to=/item%3Fid%3D38214`.
 *
 * Six of M5's surfaces are states of *who is looking* — a new account cannot flag, a moderator sees
 * shadow-banned comments, a signed-out reader gets no form. Without a switch each one would need
 * a code edit to look at, so they would stop being checked.
 *
 * **Phase 1 only. M10 deletes this file**, along with the cookie read in `getViewer` and the
 * switcher on `/settings`. Three guards keep it from being a liability before then:
 *
 *   - `as` must be one of the fixture usernames, so nothing arbitrary reaches the cookie
 *   - `to` must be a same-origin absolute path, so this cannot be used as an open redirector
 *   - it answers 404 in a production build, so it cannot outlive the fixtures by accident
 *
 * It grants a view of synthetic data that already ships in the client bundle. Once Clerk owns the
 * session that stops being true, which is why M10 removes it rather than adapting it.
 */
const ALLOWED = new Set<string>([SIGNED_OUT, ...users.map((u) => u.username)]);

export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const as = params.get("as");
  if (!as || !ALLOWED.has(as)) {
    return new Response(`Unknown viewer. One of: ${[...ALLOWED].join(", ")}`, { status: 400 });
  }

  // A protocol-relative "//host" is also a valid pathname start, so reject it explicitly.
  const to = params.get("to") ?? "/";
  const target = to.startsWith("/") && !to.startsWith("//") ? to : "/";

  (await cookies()).set(PREVIEW_COOKIE, as, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return new Response(null, { status: 303, headers: { Location: target } });
}
