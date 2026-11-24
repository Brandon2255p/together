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

/** a signed POST upload, shaped like S3's: the signed fields, then the bytes as "file" */
export async function POST(request: Request) {
  if (!stubStorage) return notFound();
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) return new Response("No file.", { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const stored = stubStorage.put(field("key"), field("token"), bytes);
  return stored ? new Response(null, { status: 204 }) : new Response("That upload isn't valid, or isn't the size that was signed.", { status: 403 });
}
