import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, serverSupabaseUrl, supabasePublishableKey } from "./config";

/** Supabase for server code, acting as the signed-in user (their session cookie), so row-level security applies */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(serverSupabaseUrl(), supabasePublishableKey(), {
    cookieOptions: { name: AUTH_COOKIE_NAME },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components can't set cookies. The proxy refreshes the session on every request, so it's safe to skip.
        }
      },
    },
  });
}
