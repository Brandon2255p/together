"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { createFolder, deleteFolder, getDocuments, moveFile, moveToBin, renameFile, renameFolder, setFileTags, signedFileUrls } from "@/lib/actions/files";
import { decryptFile } from "@/lib/files/crypto";
import { openPendingTab, saveBlob, showInTab } from "@/lib/files/client/save";
import {
  addedByName,
  countLabel,
  dateAndTime,
  fileMeta,
  filterDocuments,
  folderCounts,
  formatBytes,
  normaliseTags,
  tagLabel,
  topTags,
  typeLabel,
  typeTone,
} from "@/lib/files/documents";
import type { Documents, Hue, SharedFile, Together } from "@/lib/models";
import type { DocumentsScreenProps } from "@/components/files/documents-screen";
import type { DocumentSheetProps } from "@/components/files/document-sheet";
import type { FolderSheetData } from "@/components/files/folder-sheet";
import { asDocument, togetherKeys, useFileUpload } from "../_lib/use-file-upload";
import { useServerState } from "../_lib/server-state";

const folderHref = (id: string) => `/files/folders/${id}` as Route;
const TRY_AGAIN = "That didn't work. Try again.";

/**
 * Files (screen 39) and a folder (screen 40). Everything is encrypted in this browser with the Together's key before
 * it's uploaded, and decrypted here after it's downloaded: Storage and the server only ever see ciphertext.
 */
export function useDocumentsViewModel(initial: Documents, together: Together, folderId: string | null): DocumentsScreenProps {
  const router = useRouter();
  const [docs, setDocs] = useServerState(initial);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetBusy, setSheetBusy] = useState<DocumentSheetProps["busy"]>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);


  const [folderSheet, setFolderSheet] = useState<FolderSheetData | null>(null);
  const [folderPending, setFolderPending] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  const people = [...together.members, ...together.formerMembers];
  const folder = folderId ? (docs.folders.find((f) => f.id === folderId) ?? null) : null;
  const here = folderId ? docs.files.filter((f) => f.folderId === folderId) : docs.files;
  const shown = filterDocuments(here, { query, tag: folderId ? null : tag, folders: docs.folders, people, meId: together.meId });
  const counts = folderCounts(docs.files);
  const open = docs.files.find((f) => f.id === openId) ?? null;

  const uploader = useFileUpload({
    together,
    folderId,
    prepare: () => Promise.resolve(asDocument()),
    noun: () => "file",
    onAdded: (added) => {
      setDocs((d) => ({ ...d, files: [...[...added].reverse(), ...d.files] }));
      router.refresh();
    },
    onRestored: async () => {
      const fresh = await getDocuments();
      if (fresh.data) setDocs(fresh.data);
    },
  });

  const changeFile = (id: string, change: Partial<SharedFile>) =>
    setDocs((d) => ({ ...d, files: d.files.map((f) => (f.id === id ? { ...f, ...change } : f)) }));

  /** an optimistic edit: shown at once, put back if it isn't saved */
  async function edit(id: string, change: Partial<SharedFile>, save: () => Promise<{ success: boolean; error?: string }>) {
    const before = docs.files.find((f) => f.id === id);
    if (!before) return;
    setSheetError(null);
    changeFile(id, change);
    const result = await save();
    if (!result.success) {
      changeFile(id, before);
      setSheetError(result.error ?? TRY_AGAIN);
    }
  }

  async function fetchPlain(file: SharedFile): Promise<Blob> {
    const [ring, urls] = await Promise.all([togetherKeys(together.id), signedFileUrls([file.originalPath])]);
    const url = urls.data?.[0]?.url;
    if (!url) throw new Error(urls.error ?? "We couldn't fetch that file. Try again.");
    const response = await fetch(url);
    if (!response.ok) throw new Error("We couldn't fetch that file. Try again.");
    return decryptFile(await response.blob(), ring.keys, file.id, file.mimeType);
  }

  async function download(mode: "download" | "open") {
    if (!open || sheetBusy) return;
    // a tab opened later than the tap is blocked as a pop-up
    const tab = mode === "open" ? openPendingTab() : null;
    setSheetBusy(mode);
    setSheetError(null);
    try {
      const blob = await fetchPlain(open);
      if (mode === "open") showInTab(tab, blob, open.name);
      else saveBlob(blob, open.name);
    } catch (e) {
      tab?.close();
      setSheetError(e instanceof Error ? e.message : TRY_AGAIN);
    } finally {
      setSheetBusy(null);
    }
  }

  async function bin() {
    if (!open || sheetBusy) return;
    const file = open;
    setSheetBusy("bin");
    setSheetError(null);
    const result = await moveToBin(file.id);
    setSheetBusy(null);
    if (!result.success) return setSheetError(result.error ?? TRY_AGAIN);
    setOpenId(null);
    setDocs((d) => ({ ...d, files: d.files.filter((f) => f.id !== file.id) }));
  }

  async function makeFolder(name: string, hue: Hue) {
    if (folderPending) return;
    setFolderPending(true);
    setFolderError(null);
    const result = await createFolder(name, hue);
    setFolderPending(false);
    if (!result.data) return setFolderError(result.error ?? TRY_AGAIN);
    const made = result.data;
    setDocs((d) => ({ ...d, folders: [...d.folders, made] }));
    setFolderSheet(null);
  }

  async function renameThisFolder(name: string) {
    if (!folder || folderPending) return;
    setFolderPending(true);
    setFolderError(null);
    const result = await renameFolder(folder.id, name);
    setFolderPending(false);
    if (!result.success) return setFolderError(result.error ?? TRY_AGAIN);
    setDocs((d) => ({ ...d, folders: d.folders.map((f) => (f.id === folder.id ? { ...f, name: name.trim() } : f)) }));
    setFolderSheet(null);
  }

  async function deleteThisFolder() {
    if (!folder || folderPending) return;
    setFolderPending(true);
    setFolderError(null);
    const result = await deleteFolder(folder.id);
    if (!result.success) {
      setFolderPending(false);
      return setFolderError(result.error ?? TRY_AGAIN);
    }
    router.replace("/files");
    router.refresh();
  }

  const tags = folderId ? [] : topTags(docs.files).map((t) => ({ tag: t, label: tagLabel(t) }));
  const searching = query.trim() !== "" || (!folderId && tag !== null);
  const empty = shown.length
    ? null
    : searching
      ? { title: "Nothing matches", body: "Try other words, or clear the search." }
      : folderId
        ? { title: "Nothing in this folder yet", body: "Upload adds files straight into it." }
        : { title: "No files yet", body: "Keep IDs, passports, car papers and leases here, encrypted with your Together's own key." };

  return {
    back: folderId ? { href: "/files", label: "Files" } : { href: "/home", label: "Home" },
    title: folder?.name ?? "Files",
    searchLabel: folder ? `Search in ${folder.name}` : "Search files, tags, words…",
    query,
    onQueryChange: setQuery,
    tags,
    activeTag: tag,
    onTag: setTag,
    folders: folderId
      ? null
      : docs.folders.map((f) => ({ id: f.id, name: f.name, hue: f.hue, count: countLabel(counts[f.id] ?? 0), href: folderHref(f.id) })),
    onNewFolder: () => {
      setFolderError(null);
      setFolderSheet({ mode: "new" });
    },
    onFolderMenu: folder
      ? () => {
          setFolderError(null);
          setFolderSheet({ mode: "menu", name: folder.name, empty: !here.length });
        }
      : null,
    listTitle: folderId ? `${countLabel(shown.length)} · newest first` : searching ? "Results" : "Recent",
    rows: shown.map((f) => ({
      id: f.id,
      name: f.name,
      meta: fileMeta(f, people, together.meId),
      type: typeLabel(f.name, f.mimeType),
      tone: typeTone(f.name, f.mimeType),
      tags: f.tags.map(tagLabel),
    })),
    empty,
    onOpenFile: (id) => {
      setSheetError(null);
      setOpenId(id);
    },
    onUpload: uploader.start,
    uploading: uploader.working,
    error: uploader.error,
    documentSheet: {
      file: open
        ? {
            id: open.id,
            name: open.name,
            eyebrow: [typeLabel(open.name, open.mimeType), formatBytes(open.sizeBytes), open.folderId ? `In ${docs.folders.find((f) => f.id === open.folderId)?.name ?? "a folder"}` : null]
              .filter(Boolean)
              .join(" · "),
            folderId: open.folderId,
            folderName: docs.folders.find((f) => f.id === open.folderId)?.name ?? "None",
            added: `${addedByName(open.uploadedBy, people, together.meId)} · ${dateAndTime(open.createdAt)}`,
            tags: open.tags.map((t) => ({ tag: t, label: tagLabel(t) })),
          }
        : null,
      folders: docs.folders.map((f) => ({ id: f.id, name: f.name })),
      busy: sheetBusy,
      error: sheetError,
      onClose: () => setOpenId(null),
      onDownload: () => void download("download"),
      onOpenFile: () => void download("open"),
      onMove: (to) => open && to !== open.folderId && void edit(open.id, { folderId: to }, () => moveFile(open.id, to)),
      onRename: (name) => open && name.trim() && void edit(open.id, { name: name.trim() }, () => renameFile(open.id, name)),
      onAddTag: (t) => {
        if (!open) return;
        const next = normaliseTags([...open.tags, t]);
        void edit(open.id, { tags: next }, () => setFileTags(open.id, next));
      },
      onRemoveTag: (t) => {
        if (!open) return;
        const next = open.tags.filter((x) => x !== t);
        void edit(open.id, { tags: next }, () => setFileTags(open.id, next));
      },
      onBin: () => void bin(),
    },
    uploadSheet: uploader.sheet,
    folderSheet: {
      sheet: folderSheet,
      pending: folderPending,
      error: folderError,
      onClose: () => setFolderSheet(null),
      onCreate: (name, hue) => void makeFolder(name, hue),
      onStartRename: () => folder && setFolderSheet({ mode: "rename", name: folder.name }),
      onRename: (name) => void renameThisFolder(name),
      onDelete: () => void deleteThisFolder(),
    },
  };
}
