import type { UploadTarget } from "@/lib/models";

/**
 * Sends one encrypted object with a signed POST upload: the signed fields first, then the bytes as "file" (S3 wants the
 * file last). S3 itself refuses a body that isn't exactly the size that was signed. Browser only.
 */
export async function postUpload(target: UploadTarget, body: Blob): Promise<{ error: { message: string } | null }> {
  const form = new FormData();
  for (const [name, value] of Object.entries(target.fields)) form.append(name, value);
  form.append("file", body);
  try {
    const response = await fetch(target.url, { method: "POST", body: form });
    return { error: response.ok ? null : { message: "The file didn't upload. Try again." } };
  } catch {
    return { error: { message: "The file didn't upload. Check your connection and try again." } };
  }
}
