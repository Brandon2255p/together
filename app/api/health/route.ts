// Liveness check (CI's smoke test, uptime monitors). Public (see lib/supabase/proxy.ts), no IO.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true });
}
