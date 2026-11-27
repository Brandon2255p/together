import { NavLink } from "@/components/ui/nav-link";
import type { Route } from "next";
import { EllipsisIcon, FolderIcon } from "lucide-react";
import type { Hue } from "@/lib/models";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

const SOFT: Record<Hue, string> = {
  accent: "bg-accent-soft text-accent-ink",
  partner: "bg-partner-soft text-partner-ink",
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
};

export interface FileRowData {
  id: string;
  name: string;
  /** "Adele · 4 Nov 2026 · 1.2 MB" */
  meta: string;
  /** PDF, JPG… */
  type: string;
  tone: Hue;
  /** tag labels, ready to show */
  tags: string[];
}

/** A document in a list: its type tile, name, who · when · size, and tags. Tapping it opens the details sheet. */
export function FileRow({ file, onOpen }: { file: FileRowData; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(file.id)}
      className="flex w-full items-center gap-3.5 rounded-card bg-surface p-3 text-left transition-transform duration-200 active:scale-[0.98]"
    >
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl text-[11px] font-semibold tracking-wide", SOFT[file.tone])}>{file.type}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-body">{file.name}</span>
        <span className="truncate text-caption text-ink-muted">{file.meta}</span>
        {file.tags.length ? (
          <span className="flex flex-wrap gap-1">
            {file.tags.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </span>
        ) : null}
      </span>
      <EllipsisIcon aria-hidden className="size-5 shrink-0 text-ink-muted" />
    </button>
  );
}

export interface FolderCardData {
  id: string;
  name: string;
  /** "8 files" */
  count: string;
  hue: Hue;
  href: Route;
}

/** A folder on the drive */
export function FolderCard({ folder }: { folder: FolderCardData }) {
  return (
    <NavLink href={folder.href} className="flex min-w-0 items-center gap-3 rounded-card bg-surface p-3.5 transition-transform duration-200 active:scale-[0.98]">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-5", SOFT[folder.hue])}>
        <FolderIcon aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body">{folder.name}</span>
        <span className="text-caption text-ink-muted">{folder.count}</span>
      </span>
    </NavLink>
  );
}
