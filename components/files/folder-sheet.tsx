"use client";

import { useState } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import type { Hue } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/layout";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/utils";

const HUES: { hue: Hue; label: string; swatch: string }[] = [
  { hue: "accent", label: "Coral", swatch: "bg-accent" },
  { hue: "partner", label: "Periwinkle", swatch: "bg-partner" },
  { hue: "success", label: "Green", swatch: "bg-success" },
  { hue: "warning", label: "Yellow", swatch: "bg-warning" },
];

export type FolderSheetData =
  | { mode: "new" }
  | { mode: "menu"; name: string; empty: boolean }
  | { mode: "rename"; name: string };

export interface FolderSheetProps {
  sheet: FolderSheetData | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (name: string, hue: Hue) => void;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

/** + New folder, and a folder's ••• (rename, or delete when it's empty) */
export function FolderSheet(props: FolderSheetProps) {
  const { sheet } = props;
  const title = sheet?.mode === "new" ? "New folder" : sheet?.mode === "rename" ? "Rename folder" : (sheet?.name ?? "");
  return (
    <Sheet open={sheet !== null} onOpenChange={(open) => !open && props.onClose()} title={title} eyebrow={sheet?.mode === "menu" ? "Folder" : undefined}>
      {sheet ? <Body key={sheet.mode} {...props} sheet={sheet} /> : null}
    </Sheet>
  );
}

function Body({ sheet, pending, error, onCreate, onStartRename, onRename, onDelete }: FolderSheetProps & { sheet: FolderSheetData }) {
  const [name, setName] = useState(sheet.mode === "rename" ? sheet.name : "");
  const [hue, setHue] = useState<Hue>("accent");

  if (sheet.mode === "menu") {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="soft" block onClick={onStartRename}>
          <PencilIcon aria-hidden className="size-4" /> Rename
        </Button>
        <Button variant="soft" block className="text-accent-ink" disabled={!sheet.empty} pending={pending} onClick={onDelete}>
          <Trash2Icon aria-hidden className="size-4" /> Delete folder
        </Button>
        {!sheet.empty ? <p className="text-center text-caption text-ink-muted">Only an empty folder can be deleted. Move or bin its files first.</p> : null}
        <InlineError>{error}</InlineError>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (sheet.mode === "new") onCreate(name, hue);
        else onRename(name);
      }}
    >
      <TextField label="Folder name" placeholder="Car, Health, IDs…" value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} />
      {sheet.mode === "new" ? (
        <fieldset className="flex items-center gap-3">
          <legend className="sr-only">Colour</legend>
          {HUES.map((h) => (
            <button
              key={h.hue}
              type="button"
              aria-label={h.label}
              aria-pressed={hue === h.hue}
              onClick={() => setHue(h.hue)}
              className={cn("size-9 rounded-full ring-offset-2 ring-offset-surface transition-shadow", h.swatch, hue === h.hue && "ring-2 ring-ink")}
            />
          ))}
        </fieldset>
      ) : null}
      <InlineError>{error}</InlineError>
      <Button type="submit" block pending={pending} disabled={!name.trim()}>
        {sheet.mode === "new" ? "Make folder" : "Save"}
      </Button>
    </form>
  );
}
