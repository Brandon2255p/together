// The daily files clean-up: removes uploads that never finished (their rows and objects) and objects in the bucket
// with no row, so the database and S3 stay in step. Called by Vercel Cron (vercel.json) with
// `Authorization: Bearer $CRON_SECRET`. Public in lib/supabase/proxy.ts; the secret is the lock.
import { jobsBackend } from "@/lib/backend/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await jobsBackend.cleanUpFiles();
  if (!data) {
    console.error("[cron] files clean-up", error);
    return Response.json({ error }, { status: 500 });
  }
  console.log("[cron] files clean-up", data);
  return Response.json(data);
}
