import { serverBackend } from "@/lib/backend/server";

// A place's Google photo. Redirects to Google's image URL so the API key stays on the server. Only places in your
// Together have a photo here (row-level security), so the route can't be used to spend our quota on other photos.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = await serverBackend.getPlacePhotoUrl({ id });
  if (!url) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 302,
    // Google's image URLs last a while; caching the redirect saves a paid Places Photo request on every view
    headers: { Location: url, "Cache-Control": "private, max-age=3600" },
  });
}
