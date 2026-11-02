import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Mirrors fairway-mvp's auth callback (magic link / password recovery
// exchange). HQ doesn't have its own signup flow — accounts are the
// existing Nexus founder accounts — so there's no attribution capture here.
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options) {
            cookieStore.set({ name, value: "", ...options });
          },
        },
      }
    );

    const { data } = await supabase.auth.exchangeCodeForSession(code);

    if (data?.session?.user?.recovery_sent_at) {
      const recoverySentAt = new Date(data.session.user.recovery_sent_at).getTime();
      if (Date.now() - recoverySentAt < 10 * 60 * 1000) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }
  }

  // Rep magic links carry ?next=/rep. Allow-listed, not echoed, so the
  // callback can't be used as an open redirect.
  const next = requestUrl.searchParams.get("next") === "/rep" ? "/rep" : "/";
  return NextResponse.redirect(new URL(next, request.url));
}
