"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getGallery, galleryMonths, moveToBin, signedFileUrls } from "@/lib/actions/files";
import { decryptFile } from "@/lib/files/crypto";
import { prepareMedia } from "@/lib/files/client/media";
import { saveBlob } from "@/lib/files/client/save";
import { formatBytes } from "@/lib/files/documents";
import {
  addedLine,
  addToMonths,
  byTakenDesc,
  durationLabel,
  filterGallery,
  groupByMonth,
  isGalleryKind,
  mediaKind,
  positionLabel,
  removeFromMonths,
  takenLine,
  viewerDate,
  type GalleryFilter,
} from "@/lib/files/gallery";
import { TIME_ZONE } from "@/lib/format";
import type { Gallery, SharedFile, Together } from "@/lib/models";
import type { GalleryScreenProps } from "@/components/files/gallery-screen";
import type { PhotoViewerProps } from "@/components/files/photo-viewer";
import { useServerState } from "../_lib/server-state";
import { togetherKeys, useFileUpload } from "../_lib/use-file-upload";

const TRY_AGAIN = "That didn't work. Try again.";
const PAGE = 60;
/** signed URLs asked for at once (the action's limit is 100) */
const BATCH = 48;

/** one decrypted object at a time; `cache` keeps the blob: URL per file id */
type BlobUrls = Record<string, string>;

/**
 * The Gallery (screen 36) and its viewer (37, `?item=<id>`). Thumbs and previews are fetched as ciphertext, decrypted
 * here with the Together's key and shown from blob: URLs, which are let go when the screen closes.
 */
export function useGalleryViewModel(initial: Gallery, together: Together): GalleryScreenProps {
  const router = useRouter();
  const params = useSearchParams();
  const [gallery, setGallery] = useServerState(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [thumbs, setThumbs] = useState<BlobUrls>({});
  const [previews, setPreviews] = useState<BlobUrls>({});
  const [failed, setFailed] = useState<Record<string, true>>({});
  const [busy, setBusy] = useState<PhotoViewerProps["busy"]>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);

  const people = [...together.members, ...together.formerMembers];
  const items = gallery.items;
  const shown = filterGallery(items, { filter, query, people, meId: together.meId });
  const openId = params.get("item");
  const open = shown.find((i) => i.id === openId) ?? null;
  const openIndex = open ? shown.indexOf(open) : -1;

  // ---- decrypting thumbs and previews ----------------------------------------------------------------------------

  const urls = useRef<Set<string>>(new Set());
  const wanted = useRef<Set<string>>(new Set());
  const queue = useRef<SharedFile[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // every blob: URL made here is let go when the Gallery closes
  useEffect(() => {
    const made = urls.current;
    return () => made.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const decryptTo = useCallback(
    async (file: SharedFile, path: string, type: string): Promise<string> => {
      const [ring, signed] = await Promise.all([togetherKeys(together.id), signedFileUrls([path])]);
      const url = signed.data?.[0]?.url;
      if (!url) throw new Error(signed.error ?? "We couldn't fetch that. Try again.");
      return blobUrlOf(url, ring.keys, file.id, type, urls.current);
    },
    [together.id],
  );

  const flush = useCallback(async () => {
    flushTimer.current = null;
    while (queue.current.length) {
      const batch = queue.current.splice(0, BATCH);
      try {
        const [ring, signed] = await Promise.all([togetherKeys(together.id), signedFileUrls(batch.map((f) => f.thumbPath!))]);
        const at = new Map((signed.data ?? []).map((s) => [s.path, s.url]));
        await Promise.all(
          batch.map(async (file) => {
            const url = at.get(file.thumbPath!);
            try {
              if (!url) throw new Error("no url");
              const blobUrl = await blobUrlOf(url, ring.keys, file.id, "image/webp", urls.current);
              setThumbs((t) => ({ ...t, [file.id]: blobUrl }));
            } catch {
              // a tile that can't be shown gets the placeholder; it isn't asked for again
              setFailed((f) => ({ ...f, [`thumb:${file.id}`]: true }));
            }
          }),
        );
      } catch {
        // asked for again when they next come into view
        batch.forEach((f) => wanted.current.delete(f.id));
      }
    }
  }, [together.id]);

  const onThumbWanted = useCallback(
    (id: string) => {
      const file = items.find((i) => i.id === id);
      if (!file?.thumbPath || wanted.current.has(id)) return;
      wanted.current.add(id);
      queue.current.push(file);
      // tiles that come into view together are signed and fetched together
      flushTimer.current ??= setTimeout(() => void flush(), 30);
    },
    [items, flush],
  );

  // the open item's preview (photos) or the whole video
  useEffect(() => {
    const source = open ? viewerSource(open) : null;
    if (!open || !source || previews[open.id] || failed[open.id]) return;
    const file = open;
    let cancelled = false;
    decryptTo(file, source.path, source.type)
      .then((url) => !cancelled && setPreviews((p) => ({ ...p, [file.id]: url })))
      .catch(() => !cancelled && setFailed((f) => ({ ...f, [file.id]: true })));
    return () => {
      cancelled = true;
    };
  }, [open, previews, failed, decryptTo]);

  // ---- the viewer's place in the URL -----------------------------------------------------------------------------

  const openedHere = useRef(false);
  const show = useCallback((id: string | null, mode: "push" | "replace") => {
    const next = new URLSearchParams(window.location.search);
    if (id) next.set("item", id);
    else next.delete("item");
    const url = `${window.location.pathname}${next.size ? `?${next}` : ""}`;
    window.history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
  }, []);

  const openItem = (id: string) => {
    setViewerError(null);
    openedHere.current = true;
    show(id, "push");
  };
  const closeViewer = useCallback(() => {
    setViewerError(null);
    // back to the grid the way it was opened, so the phone's back gesture and Close agree
    if (openedHere.current) {
      openedHere.current = false;
      window.history.back();
    } else show(null, "replace");
  }, [show]);
  const step = (by: number) => {
    if (!shown[openIndex + by]) return null;
    return () => {
      // from the item in the address bar now, so two quick swipes move two items
      const current = new URLSearchParams(window.location.search).get("item");
      const next = shown[shown.findIndex((i) => i.id === current) + by];
      if (!next) return;
      setViewerError(null);
      show(next.id, "replace");
    };
  };

  // ---- paging ----------------------------------------------------------------------------------------------------

  const loadMore = useCallback(async () => {
    if (loadingMore || !gallery.next) return;
    setLoadingMore(true);
    const page = await getGallery(gallery.next, PAGE);
    setLoadingMore(false);
    if (!page.data) return setError(page.error ?? TRY_AGAIN);
    const more = page.data;
    setGallery((g) => {
      const known = new Set(g.items.map((i) => i.id));
      return { ...g, items: [...g.items, ...more.items.filter((i) => !known.has(i.id))], next: more.next };
    });
  }, [loadingMore, gallery.next, setGallery]);

  // ---- upload ----------------------------------------------------------------------------------------------------

  const uploader = useFileUpload({
    together,
    folderId: null,
    prepare: (file) => prepareMedia(file, TIME_ZONE),
    noun: (picked) => {
      const kinds = new Set(picked.map((f) => mediaKind(f.type, f.name)));
      return kinds.size === 1 && kinds.has("photo") ? "photo" : kinds.size === 1 && kinds.has("video") ? "video" : "item";
    },
    onAdded: (added) => {
      const media = added.filter((f) => isGalleryKind(f.kind));
      setGallery((g) => ({ ...g, items: [...media, ...g.items].sort(byTakenDesc), months: addToMonths(g.months, media) }));
    },
    onRestored: async () => {
      const [page, months] = await Promise.all([getGallery(null, Math.max(items.length, PAGE)), galleryMonths()]);
      if (page.data && months.data) setGallery({ ...page.data, months: months.data });
    },
  });

  // ---- viewer actions --------------------------------------------------------------------------------------------

  async function plainOriginal(file: SharedFile): Promise<Blob> {
    const [ring, signed] = await Promise.all([togetherKeys(together.id), signedFileUrls([file.originalPath])]);
    const url = signed.data?.[0]?.url;
    if (!url) throw new Error(signed.error ?? "We couldn't fetch that. Try again.");
    const response = await fetch(url);
    if (!response.ok) throw new Error("We couldn't fetch that. Try again.");
    return decryptFile(await response.blob(), ring.keys, file.id, file.mimeType);
  }

  async function download() {
    if (!open || busy) return;
    setBusy("download");
    setViewerError(null);
    try {
      saveBlob(await plainOriginal(open), open.name);
    } catch (e) {
      setViewerError(e instanceof Error ? e.message : TRY_AGAIN);
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    if (!open || busy) return;
    setBusy("share");
    setViewerError(null);
    try {
      const blob = await plainOriginal(open);
      const file = new File([blob], open.name, { type: open.mimeType });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
        } catch (e) {
          // cancelled, or the tap no longer counts as a gesture after decrypting: save it instead
          if (!(e instanceof DOMException && e.name === "AbortError")) saveBlob(blob, open.name);
        }
      } else saveBlob(blob, open.name);
    } catch (e) {
      setViewerError(e instanceof Error ? e.message : TRY_AGAIN);
    } finally {
      setBusy(null);
    }
  }

  async function bin() {
    if (!open || busy) return;
    const file = open;
    const after = shown[openIndex + 1] ?? shown[openIndex - 1] ?? null;
    setBusy("bin");
    setViewerError(null);
    const result = await moveToBin(file.id);
    setBusy(null);
    if (!result.success) return setViewerError(result.error ?? TRY_AGAIN);
    setGallery((g) => ({ ...g, items: g.items.filter((i) => i.id !== file.id), months: removeFromMonths(g.months, file) }));
    if (after) show(after.id, "replace");
    else closeViewer();
    router.refresh();
  }

  // ---- what the screen shows -------------------------------------------------------------------------------------

  const searching = query.trim() !== "" || filter !== "all";
  const empty = shown.length
    ? null
    : searching
      ? { title: "Nothing matches", body: filter === "video" && !query.trim() ? "No videos yet." : "Try other words, or clear the search." }
      : { title: "No photos yet", body: "Add photos and videos to share them here, encrypted with your Together's own key." };

  const author = open?.uploadedBy ? (people.find((p) => p.id === open.uploadedBy) ?? null) : null;

  return {
    back: { href: "/home", label: "Home" },
    query,
    onQueryChange: setQuery,
    filter,
    onFilter: setFilter,
    months: groupByMonth(shown, gallery.months, { filter }).map((m) => ({
      key: m.key,
      title: m.title,
      summary: m.summary,
      tiles: m.items.map((i) => ({
        id: i.id,
        label: `${i.kind === "video" ? "Video" : "Photo"} taken ${takenLine(i.takenAt).replace(/^Taken /, "")}`,
        src: thumbs[i.id] ?? null,
        noThumb: !i.thumbPath || failed[`thumb:${i.id}`] === true,
        duration: i.kind === "video" && i.durationMs !== null ? durationLabel(i.durationMs) : null,
      })),
    })),
    empty,
    hasMore: gallery.next !== null,
    loadingMore,
    onLoadMore: () => void loadMore(),
    onOpen: openItem,
    onThumbWanted,
    onUpload: uploader.start,
    uploading: uploader.working,
    error: error ?? uploader.error,
    viewer: {
      item:
        open && isGalleryKind(open.kind)
          ? {
              id: open.id,
              kind: open.kind,
              name: open.name,
              title: viewerDate(open.takenAt),
              position: positionLabel(open, shown),
              src: previews[open.id] ?? null,
              poster: thumbs[open.id] ?? null,
              failed: failed[open.id] === true || viewerSource(open) === null,
              addedBy: author,
              added: addedLine(open, people, together.meId),
              taken: takenLine(open.takenAt),
              file: `${open.name} · ${formatBytes(open.sizeBytes)}`,
            }
          : null,
      busy,
      error: viewerError,
      canShare: typeof navigator !== "undefined" && typeof navigator.share === "function",
      onClose: closeViewer,
      onPrev: step(-1),
      onNext: step(1),
      onDownload: () => void download(),
      onShare: () => void share(),
      onBin: () => void bin(),
    },
    uploadSheet: uploader.sheet,
  };
}

/**
 * What the viewer shows: a photo's preview, or the whole video. A photo with no preview (the browser couldn't decode it
 * when it was added) still shows as it is when it's a type every browser reads. Null when there's nothing to show.
 */
function viewerSource(file: SharedFile): { path: string; type: string } | null {
  if (file.kind === "video") return { path: file.originalPath, type: file.mimeType };
  if (file.previewPath) return { path: file.previewPath, type: "image/webp" };
  if (/^image\/(jpeg|png|gif|webp|avif)$/.test(file.mimeType)) return { path: file.originalPath, type: file.mimeType };
  return null;
}

/** fetches one encrypted object, decrypts it and gives back a blob: URL (remembered in `made` to be let go later) */
async function blobUrlOf(url: string, keys: Parameters<typeof decryptFile>[1], fileId: string, type: string, made: Set<string>): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("fetch");
  const blob = await decryptFile(await response.blob(), keys, fileId, type);
  const blobUrl = URL.createObjectURL(blob);
  made.add(blobUrl);
  return blobUrl;
}
