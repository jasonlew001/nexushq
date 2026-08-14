import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/auth";
import { exchangeCodeForToken, exchangeForLongLivedToken, saveToken } from "@/lib/instagram";

const STATE_COOKIE = "ig_oauth_state";

// Lands here after the founder approves on Instagram's consent screen (see
// authorize/route.ts). Mirrors the shape of src/app/auth/callback/route.ts
// (plain route handler, always ends in a redirect) but adds a state check —
// Instagram's authorization-code flow has no built-in CSRF protection the
// way Supabase's PKCE exchange does.
export async function GET(request: Request) {
  await requireFounder();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieStore = cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (error || !code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/social?instagram_error=1", request.url));
  }

  try {
    const shortLived = await exchangeCodeForToken(code);
    const longLived = await exchangeForLongLivedToken(shortLived.accessToken);
    await saveToken(shortLived.userId, longLived.accessToken, longLived.expiresAt);
  } catch {
    return NextResponse.redirect(new URL("/social?instagram_error=1", request.url));
  }

  return NextResponse.redirect(new URL("/social", request.url));
}
