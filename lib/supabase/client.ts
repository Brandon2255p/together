import { createBrowserClient } from "@supabase/ssr";
import { AUTH_COOKIE_NAME, publicSupabaseUrl, supabasePublishableKey } from "./config";

export function createClient() {
  return createBrowserClient(publicSupabaseUrl(), supabasePublishableKey(), {
    cookieOptions: { name: AUTH_COOKIE_NAME },
  });
}
