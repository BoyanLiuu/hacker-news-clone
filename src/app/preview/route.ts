import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { PREVIEW_COOKIE, SIGNED_OUT, SLOW_COOKIE } from "@/services/viewer";

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
/**
 * The allowlist is the usernames that actually exist, read per request rather than from a fixture
 * list. That keeps it honest after M8 reseeds, and it is the check that stops an arbitrary string
 * reaching the cookie.
 */
async function allowed(): Promise<Set<string>> {
  const rows = await db.user.findMany({ select: { username: true } });
  return new Set<string>([SIGNED_OUT, ...rows.map((r) => r.username)]);
}

export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const params = new URL(request.url).searchParams;

  // `/preview?slow=on&to=/item?id=38214` — 16x every stepped transition, so a 120 ms two-step
  // animation can actually be reviewed. Independent of `as`, so either can be set alone.
  const slow = params.get("slow");
  if (slow === "on" || slow === "off") {
    const store = await cookies();
    if (slow === "on") store.set(SLOW_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/" });
    else store.delete(SLOW_COOKIE);

    if (!params.get("as")) {
      const back = params.get("to") ?? "/";
      const dest = back.startsWith("/") && !back.startsWith("//") ? back : "/";
      return new Response(null, { status: 303, headers: { Location: dest } });
    }
  }

  const as = params.get("as");
  const names = await allowed();
  if (!as || !names.has(as)) {
    return new Response(`Unknown viewer. One of: ${[...names].join(", ")}`, { status: 400 });
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
