import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Session refresh + gate. This layer only checks "is there a session" —
// the is_founder check (and the 404-for-non-founders behavior) lives in
// requireFounder(), called from every server component and route handler.
// Middleware can't notFound()/rewrite cleanly for this case, so it stays
// edge-cheap and defers the real gate to layer 2.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth/callback");

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  // api routes handle their own auth/404 (see requireFounder() call sites) —
  // routing them through here would turn an unauthenticated fetch() into an
  // HTML redirect response instead of a clean 401/404 JSON response.
  // logo.png/icon.png are public assets (the login page's own logo, and the
  // browser favicon, both requested before/without a session) — gating them
  // turned every request for either into an HTML redirect instead of image.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logo.png|icon.png).*)"],
};
