import type { Hue, MemberId } from "./index";

// Shared Gallery and Files (docs/plans/shared-files.md). The bytes are encrypted in the browser with the Together's
// key; these are the plaintext facts Postgres keeps about them.

export type FileKind = "photo" | "video" | "document";

/** a photo, video or document in the Together's shared space */
export interface SharedFile {
  id: string;
  kind: FileKind;
  name: string;
  mimeType: string;
  /** the plaintext original */
  sizeBytes: number;
  /** what the quota counts: every encrypted object of this file */
  storedBytes: number;
  keyVersion: number;
  /** Storage path of the encrypted original */
  originalPath: string;
  folderId: string | null;
  /** lowercased */
  tags: string[];
  /** null when the person who added it has since deleted their account */
  uploadedBy: MemberId | null;
  /** ISO time it was added */
  createdAt: string;
  /** ISO time it was taken (photos and videos), or added (documents) */
  takenAt: string;
  /** photos and videos: the encrypted grid tile (≈400 px) and viewer image (≈1600 px); null when none could be made */
  thumbPath: string | null;
  previewPath: string | null;
  width: number | null;
  height: number | null;
  /** videos only */
  durationMs: number | null;
}

/** a folder in Files; one level, no sub-folders */
export interface FileFolder {
  id: string;
  name: string;
  hue: Hue;
}

/** the drive: every folder and every document that isn't in the bin, newest added first */
export interface Documents {
  folders: FileFolder[];
  files: SharedFile[];
}

/** one version of the Together's key, as the browser needs it (base64 of 32 bytes); never stored */
export interface FilesKey {
  version: number;
  key: string;
  /** the version new uploads use */
  active: boolean;
}

export interface UsagePart {
  count: number;
  bytes: number;
}

/** the Together's shared space (screen 45) and the upload check */
export interface StorageUsage {
  quotaBytes: number;
  usedBytes: number;
  photos: UsagePart;
  videos: UsagePart;
  documents: UsagePart;
  bin: UsagePart;
}

/** a file that's already in the Together, found by its content MAC before uploading a copy */
export interface DuplicateMatch {
  contentMac: string;
  fileId: string;
  name: string;
  /** null when the person who added it has since deleted their account */
  uploadedByName: string | null;
  createdAt: string;
  inBin: boolean;
}

/** what the browser says about a file it's about to upload (it picked the id, and has encrypted the bytes) */
export interface NewUpload {
  id: string;
  kind: FileKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storedBytes: number;
  keyVersion: number;
  contentMac: string;
  folderId: string | null;
  tags: string[];
  takenAt: string | null;
  /** the size of each encrypted object; storedBytes is their sum, and each signed upload accepts exactly its size */
  originalBytes: number;
  /** photos and videos: the encrypted thumb and preview, when there are any */
  thumbBytes: number | null;
  previewBytes: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

/** a signed upload for one object: POST `fields`, then the bytes as "file", to `url` (S3, or the stub) */
export interface UploadTarget {
  path: string;
  url: string;
  fields: Record<string, string>;
}

/** a started upload: where to put the bytes, or that someone else just added the same file */
export type StartedUpload = { duplicate: false; target: UploadTarget; thumb: UploadTarget | null; preview: UploadTarget | null } | { duplicate: true };

/** a signed address to fetch one encrypted object from */
export interface SignedFileUrl {
  path: string;
  url: string;
}

/** where the next gallery page starts: after this item, newest taken first */
export interface GalleryCursor {
  takenAt: string;
  id: string;
}

/** a page of photos and videos, newest taken first */
export interface GalleryPage {
  items: SharedFile[];
  /** null on the last page */
  next: GalleryCursor | null;
}

/** how many photos and videos were taken in a month (in the Together's time zone): the gallery's month headers */
export interface MonthCount {
  year: number;
  /** 1–12 */
  month: number;
  photos: number;
  videos: number;
}

/** the Gallery's first load */
export interface Gallery extends GalleryPage {
  months: MonthCount[];
}
