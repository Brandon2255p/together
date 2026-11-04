/**
 * The auth cookie's name. @supabase/ssr would derive it from the Supabase URL's hostname, but the browser and the
 * server can reach Supabase at different addresses (a public or tailnet URL vs. http://supabase-kong:8000 inside
 * Docker). A fixed name keeps them on one session.
 */
export const AUTH_COOKIE_NAME = "sb-together-auth-token";

/** Where the browser reaches Supabase. Baked into the bundle at build time. */
export const publicSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;

/** Where the server reaches Supabase: SUPABASE_URL when set (the internal address in Docker), else the public one. */
export const serverSupabaseUrl = () => process.env.SUPABASE_URL || publicSupabaseUrl();

export const supabasePublishableKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
