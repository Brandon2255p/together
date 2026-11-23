"use client";

import { useRef } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeftIcon, EllipsisIcon, FileIcon, SearchIcon, UploadIcon, XIcon } from "lucide-react";
import { PillButton } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { EmptyState, InlineError, ScreenHeader, SectionHeader } from "@/components/ui/layout";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { TextField } from "@/components/ui/text-field";
import { DocumentSheet, type DocumentSheetProps } from "./document-sheet";
import { FileRow, FolderCard, type FileRowData, type FolderCardData } from "./file-row";
import { FolderSheet, type FolderSheetProps } from "./folder-sheet";
import { UploadSheet, type UploadSheetProps } from "./upload-sheet";

export interface DocumentsScreenProps {
  back: { href: Route; label: string };
  title: string;
  searchLabel: string;
  query: string;
  onQueryChange: (query: string) => void;
  /** the drive's tag chips; none in a folder */
  tags: { tag: string; label: string }[];
  activeTag: string | null;
  onTag: (tag: string | null) => void;
  /** the drive's folders; null in a folder */
  folders: FolderCardData[] | null;
  onNewFolder: () => void;
  /** a folder's ••• (rename, delete); null on the drive */
  onFolderMenu: (() => void) | null;
  /** "Recent", "5 files · newest first" */
  listTitle: string;
  rows: FileRowData[];
  /** what to say when the list is empty: nothing here yet, or nothing matches */
  empty: { title: string; body: string } | null;
  onOpenFile: (id: string) => void;
  onUpload: (files: File[]) => void;
  uploading: boolean;
  error: string | null;
  documentSheet: DocumentSheetProps;
  uploadSheet: UploadSheetProps;
  folderSheet: FolderSheetProps;
}

/** Screen 39 (the drive) and screen 40 (a folder): search, tags, folders and documents, newest first */
export function DocumentsScreen(props: DocumentsScreenProps) {
  const { back, title, searchLabel, query, onQueryChange, tags, activeTag, onTag, folders, onNewFolder, onFolderMenu, listTitle, rows, empty } = props;
  const picker = useRef<HTMLInputElement>(null);

  return (
    <>
      <Reveal className="flex flex-col gap-5 pb-8">
        <RevealItem className="flex flex-col gap-1">
          <Link href={back.href} className="flex w-fit items-center gap-0.5 text-callout text-accent-ink">
            <ChevronLeftIcon aria-hidden className="size-4" />
            {back.label}
          </Link>
          <ScreenHeader
            title={title}
            actions={
              <>
                {onFolderMenu ? (
                  <IconButton label="Folder options" onClick={onFolderMenu}>
                    <EllipsisIcon />
                  </IconButton>
                ) : null}
                <IconButton label="Upload files" variant="ink" disabled={props.uploading} onClick={() => picker.current?.click()}>
                  <UploadIcon />
                </IconButton>
                <input
                  ref={picker}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (files.length) props.onUpload(files);
                  }}
                />
              </>
            }
          />
        </RevealItem>

        <RevealItem className="flex flex-col gap-3">
          <TextField
            label={searchLabel}
            placeholder={searchLabel}
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            icon={<SearchIcon aria-hidden />}
            trailing={
              query ? (
                <button type="button" aria-label="Clear the search" onClick={() => onQueryChange("")} className="text-ink-muted hover:text-ink">
                  <XIcon aria-hidden className="size-5" />
                </button>
              ) : null
            }
          />
          {tags.length ? (
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]" role="group" aria-label="Tags">
              <PillButton selected={activeTag === null} onClick={() => onTag(null)}>
                All
              </PillButton>
              {tags.map((t) => (
                <PillButton key={t.tag} selected={activeTag === t.tag} onClick={() => onTag(activeTag === t.tag ? null : t.tag)}>
                  {t.label}
                </PillButton>
              ))}
            </div>
          ) : null}
        </RevealItem>

        <InlineError>{props.error}</InlineError>

        {folders ? (
          <RevealItem className="flex flex-col gap-3">
            <SectionHeader
              title="Folders"
              action={
                <button type="button" onClick={onNewFolder} className="text-accent-ink">
                  + New folder
                </button>
              }
            />
            {folders.length ? (
              <div className="grid grid-cols-2 gap-2.5">
                {folders.map((f) => (
                  <FolderCard key={f.id} folder={f} />
                ))}
              </div>
            ) : (
              <p className="text-callout text-ink-muted">Folders keep things together: Car, Health, IDs…</p>
            )}
          </RevealItem>
        ) : null}

        <RevealItem className="flex flex-col gap-3">
          <SectionHeader title={listTitle} />
          {empty ? (
            <EmptyState icon={<FileIcon aria-hidden />} title={empty.title} body={empty.body} />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {rows.map((r) => (
                <li key={r.id}>
                  <FileRow file={r} onOpen={props.onOpenFile} />
                </li>
              ))}
            </ul>
          )}
        </RevealItem>
      </Reveal>

      <DocumentSheet {...props.documentSheet} />
      <UploadSheet {...props.uploadSheet} />
      <FolderSheet {...props.folderSheet} />
    </>
  );
}
