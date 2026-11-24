import { stubStorage } from "@/lib/backend/server";

// The stub backend's Storage bucket: encrypted objects kept in the dev server's memory. Signed upload and download
// addresses from the stub point here. Not found unless USE_STUB_DATABASE=true.

export const dynamic = "force-dynamic";

const notFound = () => new Response("Not found", { status: 404 });

export function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path");
  const bytes = path && stubStorage?.get(path);
  if (!bytes) return notFound();
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers: { "content-type": "application/octet-stream", "cache-control": "private, no-store" } });
}

export async function PUT(request: Request) {
  if (!stubStorage) return notFound();
  const path = new URL(request.url).searchParams.get("path") ?? "";
  const bytes = new Uint8Array(await request.arrayBuffer());
  const stored = stubStorage.put(path, request.headers.get("x-upload-token") ?? "", bytes);
  return stored ? new Response(null, { status: 204 }) : new Response("That upload address isn't valid.", { status: 403 });
}
