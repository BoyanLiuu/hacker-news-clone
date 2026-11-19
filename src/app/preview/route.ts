import { cookies } from "next/headers";
import { SLOW_COOKIE } from "@/services/viewer";

/**
 * Slow motion for reviewing the stepped animations: `/preview?slow=on&to=/item?id=38214`.
 *
 * 120 ms with `steps(2, end)` is one intermediate frame held for 60 ms, which is the doctrine
 * working and also impossible to confirm by eye. This multiplies every stepped duration by 16.
 *
 * **Do not reintroduce the viewer switch.** It set a cookie naming which fixture user you were:
 * harmless over synthetic data, privilege escalation over real Clerk sessions. Sign in instead.
 *
 * Still phase-1 tooling: 404s in production so it cannot outlive its usefulness, and `to` must be a
 * same-origin absolute path so this is not an open redirector.
 */
export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const slow = params.get("slow");
  if (slow !== "on" && slow !== "off") {
    return new Response("Pass slow=on or slow=off", { status: 400 });
  }

  const store = await cookies();
  if (slow === "on") store.set(SLOW_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/" });
  else store.delete(SLOW_COOKIE);

  // A protocol-relative "//host" is also a valid pathname start, so reject it explicitly.
  const to = params.get("to") ?? "/";
  const target = to.startsWith("/") && !to.startsWith("//") ? to : "/";

  return new Response(null, { status: 303, headers: { Location: target } });
}
