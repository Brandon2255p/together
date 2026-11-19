import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serverSupabaseUrl, supabasePublishableKey } from "./config";

/**
 * Supabase with only the publishable key and no session: the `anon` role, so row-level security hides every row. For
 * server code answering someone who isn't signed in, such as a calendar app fetching the feed with its token.
 */
export function createAnonClient() {
  return createSupabaseClient(serverSupabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
