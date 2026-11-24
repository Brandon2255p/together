import { exifTakenAt, mediaKind, scaledSize, type GalleryKind } from "@/lib/files/gallery";

// Thumbnails, previews and the taken date for a photo or video, made in this browser before it's encrypted (the
// server never sees the pixels, so it couldn't make them). Browser only: view-models call this, components don't.

const THUMB_EDGE = 400;
const PREVIEW_EDGE = 1600;

export interface PreparedMedia {
  kind: GalleryKind;
  /** ISO; from EXIF for photos, else the file's own date */
  takenAt: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  /** ≈400 px on the short side, for grid tiles; null when the browser can't decode it (HEIC outside Safari, say) */
  thumb: Blob | null;
  /** ≈1600 px on the long side, for the viewer; photos only (a video plays its original) */
  preview: Blob | null;
}

type Drawable = ImageBitmap | HTMLVideoElement;

/** draws `source` at the given size and encodes it as WebP (JPEG where the browser can't write WebP) */
async function encode(source: Drawable, size: { width: number; height: number }): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, size.width, size.height);
  const toBlob = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await toBlob("image/webp", 0.8);
  // Safari gives back a PNG when asked for WebP; a JPEG is far smaller
  return webp?.type === "image/webp" ? webp : toBlob("image/jpeg", 0.82);
}

async function photoTakenAt(file: File, timeZone: string): Promise<string | null> {
  try {
    const { default: exifr } = await import("exifr");
    const tags = (await exifr.parse(file, { pick: ["DateTimeOriginal", "OffsetTimeOriginal", "CreateDate", "OffsetTime"], reviveValues: false })) as
      | Record<string, unknown>
      | undefined;
    if (!tags) return null;
    return exifTakenAt(tags.DateTimeOriginal ?? tags.CreateDate, tags.OffsetTimeOriginal ?? tags.OffsetTime, timeZone);
  } catch {
    return null;
  }
}

async function preparePhoto(file: File, timeZone: string): Promise<PreparedMedia> {
  const fallback = new Date(file.lastModified || Date.now()).toISOString();
  const takenAt = (await photoTakenAt(file, timeZone)) ?? fallback;
  let bitmap: ImageBitmap;
  try {
    // EXIF orientation is applied, so a portrait phone photo stays upright
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { kind: "photo", takenAt, width: null, height: null, durationMs: null, thumb: null, preview: null };
  }
  try {
    const { width, height } = bitmap;
    const thumb = await encode(bitmap, scaledSize(width, height, THUMB_EDGE, "short"));
    const preview = await encode(bitmap, scaledSize(width, height, PREVIEW_EDGE, "long"));
    return { kind: "photo", takenAt, width, height, durationMs: null, thumb, preview };
  } finally {
    bitmap.close();
  }
}

/** the video's size, length and a poster frame from about a second in */
async function prepareVideo(file: File): Promise<PreparedMedia> {
  const takenAt = new Date(file.lastModified || Date.now()).toISOString();
  const empty: PreparedMedia = { kind: "video", takenAt, width: null, height: null, durationMs: null, thumb: null, preview: null };
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const once = (event: string) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 15_000);
      video.addEventListener(event, () => (clearTimeout(timer), resolve()), { once: true });
      video.addEventListener("error", () => (clearTimeout(timer), reject(new Error("decode"))), { once: true });
    });
  try {
    const loaded = once("loadeddata");
    video.src = url;
    await loaded;
    const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null;
    const { videoWidth: width, videoHeight: height } = video;
    if (!width || !height) return { ...empty, durationMs };
    const seeked = once("seeked");
    video.currentTime = Math.min(1, (video.duration || 0) / 2);
    await seeked;
    const thumb = await encode(video, scaledSize(width, height, THUMB_EDGE, "short"));
    return { kind: "video", takenAt, width, height, durationMs, thumb, preview: null };
  } catch {
    return empty;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** what the Gallery needs to know about a picked file; null when it isn't a photo or video */
export async function prepareMedia(file: File, timeZone: string): Promise<PreparedMedia | null> {
  const kind = mediaKind(file.type, file.name);
  if (kind === "photo") return preparePhoto(file, timeZone);
  if (kind === "video") return prepareVideo(file);
  return null;
}
