"use client";

import { FileIcon, LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/layout";
import { Progress } from "@/components/ui/progress";
import { Sheet } from "@/components/ui/sheet";

export interface SkippedFileData {
  /** the name of the file you picked */
  name: string;
  /** "Adele added it · 3 Nov", "You added it · 3 Nov", or "It's in the bin" */
  detail: string;
  /** set when the copy that's already there is in the bin */
  restoreId: string | null;
}

export type UploadSheetData =
  | { stage: "working"; title: string; detail: string; done: number; total: number }
  | { stage: "done"; overline: string; title: string; skipped: SkippedFileData[]; failed: string[] }
  | { stage: "blocked"; title: string; message: string };

export interface UploadSheetProps {
  upload: UploadSheetData | null;
  /** the file whose restore is running */
  restoring: string | null;
  error: string | null;
  onRestore: (fileId: string) => void;
  onClose: () => void;
}

/** Uploading, then screen 38: what was added and the exact copies that were skipped */
export function UploadSheet({ upload, restoring, error, onRestore, onClose }: UploadSheetProps) {
  const working = upload?.stage === "working";
  return (
    <Sheet
      open={upload !== null}
      // an upload in progress can't be dismissed
      onOpenChange={(open) => !open && !working && onClose()}
      title={upload?.title ?? ""}
      eyebrow={upload?.stage === "done" ? upload.overline : upload?.stage === "blocked" ? "Nothing was sent" : "Encrypting and uploading"}
    >
      {upload?.stage === "working" ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <Progress value={upload.total ? upload.done / upload.total : 0} label="Upload progress" />
          <p className="flex items-center gap-2 text-callout text-ink-muted">
            <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
            {upload.detail}
          </p>
        </div>
      ) : null}

      {upload?.stage === "blocked" ? <p className="text-callout text-ink-muted">{upload.message}</p> : null}

      {upload?.stage === "done" ? (
        <>
          {upload.skipped.length ? (
            <div className="flex flex-col gap-3 rounded-card bg-surface-muted p-4">
              <p className="text-callout">These were already in Files, so we didn&apos;t add them twice.</p>
              <ul className="flex flex-col gap-3">
                {upload.skipped.map((s) => (
                  <li key={s.name} className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-ink-muted [&_svg]:size-5">
                      <FileIcon aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-callout">{s.name}</span>
                      <span className="text-caption text-ink-muted">{s.detail}</span>
                    </span>
                    {s.restoreId ? (
                      <Button variant="outline" size="sm" pending={restoring === s.restoreId} onClick={() => onRestore(s.restoreId!)}>
                        Restore it
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {upload.failed.length ? (
            <InlineError>
              {upload.failed.length === 1 ? `${upload.failed[0]} didn't upload.` : `${upload.failed.length} files didn't upload: ${upload.failed.join(", ")}.`} Try adding{" "}
              {upload.failed.length === 1 ? "it" : "them"} again.
            </InlineError>
          ) : null}
        </>
      ) : null}

      <InlineError>{error}</InlineError>
      {!working ? (
        <Button block onClick={onClose}>
          Done
        </Button>
      ) : null}
    </Sheet>
  );
}
