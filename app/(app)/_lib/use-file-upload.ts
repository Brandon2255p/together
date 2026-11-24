"use client";

import { useState } from "react";
import { filesKeys, findDuplicates, finishUpload, restoreFile, startUpload, storageUsage } from "@/lib/actions/files";
import { browserBackend } from "@/lib/backend/browser";
import { contentMac, encryptedSize, encryptFile } from "@/lib/files/crypto";
import { keyring, type Keyring } from "@/lib/files/client/keyring";
import { countLabel, dayAndMonth, spaceCheck, uploadSummary } from "@/lib/files/documents";
import type { FileKind, Member, SharedFile, Together } from "@/lib/models";
import type { SkippedFileData, UploadSheetData } from "@/components/files/upload-sheet";

const TRY_AGAIN = "That didn't work. Try again.";

/** what's known about a picked file before it's encrypted: its kind, and for photos and videos, thumbs and sizes */
export interface PreparedFile {
  kind: FileKind;
  takenAt: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  thumb: Blob | null;
  preview: Blob | null;
}

export const asDocument = (): PreparedFile => ({ kind: "document", takenAt: null, width: null, height: null, durationMs: null, thumb: null, preview: null });

/** the keys for this Together: fetched once, then kept in memory for this tab */
export const togetherKeys = (togetherId: string): Promise<Keyring> => keyring(togetherId, () => filesKeys());

export interface FileUploadOptions {
  together: Together;
  /** what each file is; null leaves it out ("not a photo or video") */
  prepare: (file: File) => Promise<PreparedFile | null>;
  folderId: string | null;
  /** "file", or "photo" / "video" / "item" from what was picked */
  noun: (picked: File[]) => string;
  /** shows what was added straight away; the view-model refreshes the rest */
  onAdded: (added: SharedFile[]) => void;
  /** after a binned copy is restored, reload what the screen shows */
  onRestored: () => Promise<void>;
}

/**
 * The upload shared by Files and the Gallery (screen 38): fingerprint each file, skip copies already in the Together
 * (offering to restore ones in the bin), check the space, then encrypt and send each file (and its thumb and preview)
 * straight to Storage.
 */
export function useFileUpload({ together, prepare, folderId, noun, onAdded, onRestored }: FileUploadOptions) {
  const [upload, setUpload] = useState<UploadSheetData | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const people: Member[] = [...together.members, ...together.formerMembers];
  const meName = people.find((p) => p.id === together.meId)?.name;

  async function start(picked: File[]) {
    if (upload?.stage === "working") return;
    setUploadError(null);
    setError(null);
    const total = picked.length;
    const what = noun(picked);
    const working = (detail: string, done = 0): UploadSheetData => ({ stage: "working", title: `Adding ${countLabel(total, what)}`, detail, done, total });
    setUpload(working("Checking for copies…"));
    try {
      const ring = await togetherKeys(together.id);
      // the fingerprint of each file: equal files match within this Together only
      const macs = await Promise.all(picked.map((file) => contentMac(file, ring.active)));
      const seen = new Set<string>();
      const fresh: { file: File; mac: string }[] = [];
      const skipped: SkippedFileData[] = [];
      picked.forEach((file, i) => {
        const mac = macs[i]!;
        if (seen.has(mac)) skipped.push({ name: file.name, detail: "The same file was picked twice", restoreId: null });
        else fresh.push({ file, mac });
        seen.add(mac);
      });

      const dupes = await findDuplicates(fresh.map((f) => f.mac));
      if (dupes.error) throw new Error(dupes.error);
      const known = new Map((dupes.data ?? []).map((d) => [d.contentMac, d]));
      const unknown = fresh.filter(({ file, mac }) => {
        const match = known.get(mac);
        if (!match) return true;
        const who = match.uploadedByName && match.uploadedByName === meName ? "You" : (match.uploadedByName ?? "Someone");
        const when = dayAndMonth(match.createdAt);
        skipped.push({ name: file.name, detail: match.inBin ? `In the bin · ${who} added it · ${when}` : `${who} added it · ${when}`, restoreId: match.inBin ? match.fileId : null });
        return false;
      });

      // thumbnails and previews are made here, before anything is sent, so the space check counts them too
      const toSend: { file: File; mac: string; prep: PreparedFile }[] = [];
      for (const [i, item] of unknown.entries()) {
        setUpload(working(`Getting ${item.file.name} ready`, i));
        const prep = await prepare(item.file);
        if (prep) toSend.push({ ...item, prep });
        else skipped.push({ name: item.file.name, detail: "Not a photo or video", restoreId: null });
      }
      const sizeOf = ({ file, prep }: (typeof toSend)[number]) =>
        encryptedSize(file.size) + (prep.thumb ? encryptedSize(prep.thumb.size) : 0) + (prep.preview ? encryptedSize(prep.preview.size) : 0);

      const usage = await storageUsage();
      if (!usage.data) throw new Error(usage.error ?? TRY_AGAIN);
      const space = spaceCheck(usage.data, toSend.map(sizeOf));
      if (!space.fits) {
        setUpload({ stage: "blocked", title: "Not enough space", message: space.message });
        return;
      }

      const added: SharedFile[] = [];
      const failed: string[] = [];
      for (const [i, { file, mac, prep }] of toSend.entries()) {
        setUpload(working(`Encrypting and uploading ${file.name}`, i));
        const id = crypto.randomUUID();
        // the thumb and preview are sealed with the file's own key, like the original
        const [sealed, thumb, preview] = await Promise.all([
          encryptFile(file, ring.active, id),
          prep.thumb ? encryptFile(prep.thumb, ring.active, id) : Promise.resolve(null),
          prep.preview ? encryptFile(prep.preview, ring.active, id) : Promise.resolve(null),
        ]);
        const mimeType = file.type || (prep.kind === "photo" && /\.hei[cf]$/i.test(file.name) ? "image/heic" : "application/octet-stream");
        const started = await startUpload(together.id, {
          id,
          kind: prep.kind,
          name: file.name,
          mimeType,
          sizeBytes: file.size,
          storedBytes: sealed.size + (thumb?.size ?? 0) + (preview?.size ?? 0),
          keyVersion: ring.active.version,
          contentMac: mac,
          folderId: prep.kind === "document" ? folderId : null,
          tags: [],
          takenAt: prep.takenAt,
          hasThumb: thumb !== null,
          hasPreview: preview !== null,
          width: prep.width,
          height: prep.height,
          durationMs: prep.durationMs,
        });
        if (!started.data) {
          // space runs out part way: the rest won't fit either
          if (started.error?.startsWith("Not enough space")) {
            failed.push(...toSend.slice(i).map((f) => f.file.name));
            setUploadError(started.error);
            break;
          }
          failed.push(file.name);
          continue;
        }
        if (started.data.duplicate) {
          skipped.push({ name: file.name, detail: "Someone added it just now", restoreId: null });
          continue;
        }
        const { target, thumb: thumbTarget, preview: previewTarget } = started.data;
        const sends = [
          browserBackend.uploadFileObject({ path: target.path, token: target.token, body: sealed }),
          thumb && thumbTarget ? browserBackend.uploadFileObject({ path: thumbTarget.path, token: thumbTarget.token, body: thumb }) : Promise.resolve(null),
          preview && previewTarget ? browserBackend.uploadFileObject({ path: previewTarget.path, token: previewTarget.token, body: preview }) : Promise.resolve(null),
        ];
        const sent = await Promise.all(sends);
        const finished = sent.some((s) => s?.error) ? { success: false } : await finishUpload(id);
        if (!finished.success) {
          failed.push(file.name);
          continue;
        }
        const now = new Date().toISOString();
        added.push({
          id,
          kind: prep.kind,
          name: file.name,
          mimeType,
          sizeBytes: file.size,
          storedBytes: sealed.size + (thumb?.size ?? 0) + (preview?.size ?? 0),
          keyVersion: ring.active.version,
          originalPath: target.path,
          folderId: prep.kind === "document" ? folderId : null,
          tags: [],
          uploadedBy: together.meId,
          createdAt: now,
          takenAt: prep.takenAt ?? now,
          thumbPath: thumbTarget?.path ?? null,
          previewPath: previewTarget?.path ?? null,
          width: prep.width,
          height: prep.height,
          durationMs: prep.kind === "video" ? prep.durationMs : null,
        });
      }

      if (added.length) onAdded(added);
      const summary = uploadSummary(added.length, skipped.length, noun(picked));
      setUpload({ stage: "done", overline: summary.overline, title: summary.title, skipped, failed });
    } catch (e) {
      setUpload(null);
      setError(e instanceof Error ? e.message : "We couldn't add those files. Try again.");
    }
  }

  async function restore(fileId: string) {
    if (restoring) return;
    setRestoring(fileId);
    setUploadError(null);
    const result = await restoreFile(fileId);
    if (!result.success) {
      setRestoring(null);
      return setUploadError(result.error ?? TRY_AGAIN);
    }
    await onRestored();
    setRestoring(null);
    setUpload((u) =>
      u?.stage === "done" ? { ...u, skipped: u.skipped.map((s) => (s.restoreId === fileId ? { ...s, detail: "Restored from the bin ✓", restoreId: null } : s)) } : u,
    );
  }

  return {
    error,
    working: upload?.stage === "working",
    start: (files: File[]) => void start(files),
    sheet: {
      upload,
      restoring,
      error: uploadError,
      onRestore: (id: string) => void restore(id),
      onClose: () => setUpload(null),
    },
  };
}
