// The calendar feed: GET /api/calendar/<token>.ics returns the Together's plans as iCalendar, for Google Calendar,
// Apple Calendar and Outlook to subscribe to. Calendar apps send no cookies, so it's public in lib/supabase/proxy.ts;
// the 64-character token is the lock. People get theirs from the calendar's "Sync" sheet.
import { jobsBackend } from "@/lib/backend/jobs";
import { buildIcs } from "@/lib/calendar/ics";

export const dynamic = "force-dynamic";

const TOKEN = /^[0-9a-f]{64}$/;

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/, "");
  if (!TOKEN.test(token)) return new Response("Not found", { status: 404 });

  const { data, error } = await jobsBackend.calendarFeed({ token });
  if (error) {
    console.error("[calendar feed]", error);
    return new Response("The calendar isn't available right now.", { status: 503 });
  }
  if (!data) return new Response("Not found", { status: 404 });

  return new Response(buildIcs(data, { appUrl: new URL(request.url).origin }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="together.ics"',
      // calendar apps poll; a few minutes of caching keeps that cheap without delaying changes much
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
