import { LockIcon } from "lucide-react";
import type { UsageKey, UsageView } from "@/lib/files/usage";
import { cn } from "@/lib/utils";

const SWATCH: Record<UsageKey, string> = {
  photos: "bg-partner",
  videos: "bg-accent",
  documents: "bg-success",
  bin: "bg-ink-subtle",
};

/** Screen 45: how much of the Together's shared space is used, by what, and how it's kept private */
export function StorageCard({ usage }: { usage: UsageView }) {
  return (
    <div className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card">
      <div className="flex flex-col gap-1">
        <p className="text-title">{usage.headline}</p>
        <p className="text-caption text-ink-muted">{usage.left}</p>
      </div>

      <div
        role="img"
        aria-label={`${Math.round(usage.used * 100)}% used: ${usage.parts.map((p) => `${p.label} ${p.size}`).join(", ")}`}
        className="flex h-3 overflow-hidden rounded-full bg-surface-muted"
      >
        {usage.parts.map((p) =>
          p.fraction > 0 ? <span key={p.key} className={cn("h-full", SWATCH[p.key])} style={{ width: `max(${p.fraction * 100}%, 3px)` }} /> : null,
        )}
      </div>

      <ul className="flex flex-col gap-3">
        {usage.parts.map((p) => (
          <li key={p.key} className="flex items-center gap-3">
            <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", SWATCH[p.key])} />
            <span className="flex-1 text-callout">
              {p.label} <span className="text-ink-muted">· {p.count}</span>
            </span>
            <span className="text-callout tabular-nums text-ink-muted">{p.size}</span>
          </li>
        ))}
      </ul>
      {usage.binNote ? <p className="text-caption text-ink-muted">{usage.binNote}</p> : null}
    </div>
  );
}

/** Screen 45's privacy note */
export function PrivacyCard() {
  return (
    <div className="flex items-start gap-3 rounded-card bg-surface p-5 shadow-card">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success-soft text-success-ink">
        <LockIcon aria-hidden className="size-5" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-body-strong">Encrypted with your Together&apos;s own key</span>
        <span className="text-caption text-ink-muted">
          Photos, videos and files are encrypted on your phone before they&apos;re uploaded, and only people in this Together can open them.
        </span>
      </span>
    </div>
  );
}
