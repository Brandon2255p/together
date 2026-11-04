import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serverSupabaseUrl } from "./config";

/**
 * Supabase with the secret (service role) key: bypasses row-level security. Only for scheduled jobs
 * (lib/backend/services/real/jobs.ts), never for anything a person asked for. Null when SUPABASE_SECRET_KEY isn't set.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createSupabaseClient(serverSupabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}
