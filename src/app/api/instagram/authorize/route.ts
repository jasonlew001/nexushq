import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/auth";

const STATE_COOKIE = "ig_oauth_state";

// Founder clicks "Connect Instagram" (InstagramCard) → here → Instagram's
// consent screen → src/app/api/instagram/callback/route.ts. Founder-only
// admin action, so this is gated the same as every server component (the
// callback route re-checks too, since the browser could in theory hit it
// directly after this redirect without ever having been authorized here).
export async function GET() {
  await requireFounder();

  const appId = process.env.INSTAGRAM_APP_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!appId || !redirectUri) {
    throw new Error("INSTAGRAM_APP_ID / INSTAGRAM_REDIRECT_URI not configured");
  }

  // CSRF guard — Supabase's own callback doesn't need this (PKCE handled
  // internally), but Instagram's plain authorization-code flow does.
  const state = randomBytes(24).toString("hex");
  cookies().set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 min — the whole consent round-trip should take seconds
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "instagram_business_basic,instagram_business_manage_insights",
    state,
  });

  return NextResponse.redirect(`https://www.instagram.com/oauth/authorize?${params.toString()}`);
}
