import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { PREVIEW_COOKIE, SIGNED_OUT, SLOW_COOKIE } from "@/services/viewer";

/**
 * The fixture viewer switch: `/preview?as=fernhill&to=/item%3Fid%3D38214`. Several surfaces are
 * states of *who is looking*, and without this each needs a code edit to see.
 *
 * **Phase 1 only — M10 deletes this file**, the cookie read in `getViewer`, and the `/settings`
 * switcher. Guarded three ways meanwhile: `as` must match a real username, `to` must be a
 * same-origin absolute path (not an open redirector), and it 404s in a production build.
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

  // 16x every stepped transition, so a 120 ms two-step animation can be reviewed at all.
  // Independent of `as`, so either can be set alone.
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
