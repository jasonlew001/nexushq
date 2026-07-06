import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

if (typeof window !== "undefined") {
  throw new Error("supabase-server.ts must never be imported client-side");
}

// Founder-session client — anon key + cookies. RLS policy `founders_read_all`
// grants this session read access to every user_profiles row once is_founder()
// is true, so most reads never need the service-role client below.
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Cookie setting may fail in Server Components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Cookie removal may fail in Server Components
          }
        },
      },
    }
  );
}

// Service-role client — only for auth.users (emails, created_at) via the
// admin API. RLS-blind; never used for user_profiles or anything a founder
// session can already read.
export function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input, init = {}) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
