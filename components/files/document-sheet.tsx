"use client";

import { useState } from "react";
import { CheckIcon, ChevronRightIcon, DownloadIcon, FolderIcon, FolderInputIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/layout";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/utils";

export interface DocumentSheetData {
  id: string;
  name: string;
  /** "PDF · 410 KB · In Car" */
  eyebrow: string;
  folderName: string;
  folderId: string | null;
  /** "Adele · 30 Oct 2026, 09:14" */
  added: string;
  tags: { tag: string; label: string }[];
}

export interface DocumentSheetProps {
  file: DocumentSheetData | null;
  folders: { id: string; name: string }[];
  /** which action is running: the buttons show it and wait */
  busy: "download" | "open" | "bin" | "save" | null;
  error: string | null;
  onClose: () => void;
  onDownload: () => void;
  onOpenFile: () => void;
  onMove: (folderId: string | null) => void;
  onRename: (name: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onBin: () => void;
}

type Mode = "details" | "move" | "rename" | "tag";

/** Screen 41: a document's details, with Download, Move, Move to bin and Open */
export function DocumentSheet(props: DocumentSheetProps) {
  const { file } = props;
  return (
    <Sheet open={file !== null} onOpenChange={(open) => !open && props.onClose()} title={file?.name ?? ""} eyebrow={file?.eyebrow}>
      {/* keyed by file so each opens on its details */}
      {file ? <SheetBody key={file.id} {...props} file={file} /> : null}
    </Sheet>
  );
}

function SheetBody({ file, folders, busy, error, onDownload, onOpenFile, onMove, onRename, onAddTag, onRemoveTag, onBin }: DocumentSheetProps & { file: DocumentSheetData }) {
  const [mode, setMode] = useState<Mode>("details");
  const [draft, setDraft] = useState("");

  if (mode === "move") {
    const options = [{ id: null, name: "No folder" }, ...folders];
    return (
      <div className="flex flex-col gap-2">
        <p className="text-overline text-ink-muted">Move to</p>
        {options.map((f) => (
          <button
            key={f.id ?? "none"}
            type="button"
            onClick={() => {
              onMove(f.id);
              setMode("details");
            }}
            className="flex items-center gap-3 rounded-2xl bg-surface-muted px-4 py-3.5 text-left text-body"
          >
            <FolderIcon aria-hidden className="size-5 text-ink-muted" />
            <span className="flex-1">{f.name}</span>
            {f.id === file.folderId ? <CheckIcon aria-label="Here now" className="size-5" /> : null}
          </button>
        ))}
        <Button variant="ghost" size="md" onClick={() => setMode("details")}>
          Cancel
        </Button>
      </div>
    );
  }

  if (mode === "rename" || mode === "tag") {
    const renaming = mode === "rename";
    const save = () => {
      if (renaming) onRename(draft);
      else onAddTag(draft);
      setMode("details");
    };
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <TextField
          label={renaming ? "Name" : "Tag"}
          placeholder={renaming ? "Name" : "passport, car, house…"}
          value={draft}
          maxLength={renaming ? 200 : 30}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="soft" size="md" onClick={() => setMode("details")}>
            Cancel
          </Button>
          <Button type="submit" size="md" disabled={!draft.trim()}>
            {renaming ? "Rename" : "Add tag"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <>
      <dl className="flex flex-col gap-3 rounded-card bg-surface-muted p-4 text-callout">
        <button type="button" onClick={() => setMode("move")} className="flex items-center justify-between gap-3 text-left">
          <dt className="text-ink-muted">Folder</dt>
          <dd className="flex items-center gap-1">
            {file.folderName}
            <ChevronRightIcon aria-hidden className="size-4 text-ink-muted" />
          </dd>
        </button>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-muted">Added</dt>
          <dd className="text-right">{file.added}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="pt-1 text-ink-muted">Tags</dt>
          <dd className="flex flex-wrap justify-end gap-1.5">
            {file.tags.map((t) => (
              <span key={t.tag} className="inline-flex items-center gap-1 rounded-chip bg-surface py-1 pr-1.5 pl-2.5 text-caption">
                {t.label}
                <button type="button" aria-label={`Remove the ${t.label} tag`} onClick={() => onRemoveTag(t.tag)} className="text-ink-muted hover:text-ink">
                  <XIcon aria-hidden className="size-3.5" />
                </button>
              </span>
            ))}
            {file.tags.length < 10 ? (
              <button
                type="button"
                onClick={() => {
                  setDraft("");
                  setMode("tag");
                }}
                className="inline-flex items-center gap-1 rounded-chip px-2 py-1 text-caption text-ink-muted hover:text-ink"
              >
                <PlusIcon aria-hidden className="size-3.5" /> Tag
              </button>
            ) : null}
          </dd>
        </div>
      </dl>
      <InlineError>{error}</InlineError>
      <div className="grid grid-cols-3 gap-2">
        <Action label="Download" onClick={onDownload} busy={busy === "download"}>
          <DownloadIcon aria-hidden />
        </Action>
        <Action label="Move" onClick={() => setMode("move")}>
          <FolderInputIcon aria-hidden />
        </Action>
        <Action label="Move to bin" onClick={onBin} busy={busy === "bin"} danger>
          <Trash2Icon aria-hidden />
        </Action>
      </div>
      <div className="flex flex-col gap-1">
        <Button block onClick={onOpenFile} pending={busy === "open"}>
          Open
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={() => {
            setDraft(file.name);
            setMode("rename");
          }}
        >
          <PencilIcon aria-hidden className="size-4" /> Rename
        </Button>
      </div>
    </>
  );
}

function Action({ label, onClick, busy, danger, children }: { label: string; onClick: () => void; busy?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl py-3.5 text-caption transition-transform duration-200 active:scale-[0.97] disabled:opacity-50 [&_svg]:size-5",
        danger ? "bg-accent-soft text-accent-ink" : "bg-surface-muted text-ink",
      )}
    >
      {children}
      {busy ? "…" : label}
    </button>
  );
}
