import type { StorageUsage } from "@/lib/models";
import { formatBytes } from "./documents";

// The Together's shared space, as the Together screen shows it (screen 45): a bar split by what uses it, and a row each.

export type UsageKey = "photos" | "videos" | "documents" | "bin";

export interface UsagePartView {
  key: UsageKey;
  label: string;
  /** "1,204 photos" */
  count: string;
  /** "12.1 GB" */
  size: string;
  /** its share of the whole quota, 0–1, for the bar */
  fraction: number;
}

export interface UsageView {
  /** "31.6 GB of 50 GB" */
  headline: string;
  /** "18.4 GB left. Everyone in the Together shares this space." */
  left: string;
  /** used / quota, 0–1 */
  used: number;
  parts: UsagePartView[];
  /** said under the bin row when there's something in it */
  binNote: string | null;
}

const NOUNS: Record<UsageKey, [string, string, string]> = {
  photos: ["Photos", "photo", "photos"],
  videos: ["Videos", "video", "videos"],
  documents: ["Files", "file", "files"],
  bin: ["Bin", "item", "items"],
};

const number = (n: number) => new Intl.NumberFormat("en-GB").format(n);

/** GB to one decimal ("31.6 GB", "50 GB"), so small changes show; smaller amounts as formatBytes says them */
function size(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1).replace(/\.0$/, "")} GB` : formatBytes(bytes);
}

export function usageView(usage: StorageUsage): UsageView {
  const quota = Math.max(usage.quotaBytes, 1);
  const left = Math.max(usage.quotaBytes - usage.usedBytes, 0);
  const parts = (["photos", "videos", "documents", "bin"] as const).map((key): UsagePartView => {
    const { count, bytes } = usage[key];
    const [label, one, many] = NOUNS[key];
    return { key, label, count: `${number(count)} ${count === 1 ? one : many}`, size: bytes ? size(bytes) : "0 KB", fraction: Math.min(bytes / quota, 1) };
  });
  return {
    headline: `${size(usage.usedBytes)} of ${size(usage.quotaBytes)}`,
    left: left ? `${size(left)} left. Everyone in the Together shares this space.` : "No space left. Empty the bin or remove something to add more.",
    used: Math.min(usage.usedBytes / quota, 1),
    parts,
    binNote: usage.bin.count ? "Things in the bin still count until they're deleted, 30 days after they were binned." : null,
  };
}
