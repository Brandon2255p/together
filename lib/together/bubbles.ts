import type { MemberTone, TogetherSummary } from "@/lib/models";

// Shapes your Togethers into bubbles for /togethers (screen 17): a size from how recently something happened there,
// a stable colour, and positions that don't overlap.

const TONES: MemberTone[] = ["accent", "partner", "success", "warning"];
const DAY_MS = 86_400_000;
/** activity this many days old makes a bubble half as much bigger than the smallest */
const HALF_LIFE_DAYS = 3;
export const MIN_RADIUS = 0.55;
export const MAX_RADIUS = 1;
/** the gap left between two bubbles; the blobs wobble outward by up to about a fifth of their size */
const GAP = 0.35;

/** bigger the more recent the activity: MAX_RADIUS for right now, shrinking toward MIN_RADIUS */
export function bubbleRadius(lastActivityAt: string, now: number): number {
  const ageDays = Math.max(0, (now - Date.parse(lastActivityAt)) / DAY_MS);
  if (!Number.isFinite(ageDays)) return MIN_RADIUS;
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * 2 ** (-ageDays / HALF_LIFE_DAYS);
}

/** the same colour for a Together every time, from its id */
export function bubbleTone(togetherId: string): MemberTone {
  let hash = 0;
  for (const ch of togetherId) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return TONES[Math.abs(hash) % TONES.length] ?? "accent";
}

export interface Bubble {
  id: string;
  name: string;
  /** "3 people · active 2h ago" */
  detail: string;
  tone: MemberTone;
  radius: number;
  /** x, y, z in scene units; the current Together sits in the middle */
  position: [number, number, number];
  current: boolean;
  hasNews: boolean;
}

/** "just now", "5m ago", "2h ago", "3d ago", "6w ago" */
export function activityAgo(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (!Number.isFinite(minutes) || minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

export function bubbleDetail(t: Pick<TogetherSummary, "memberCount" | "lastActivityAt">, now: number): string {
  const people = t.memberCount === 1 ? "Just you" : `${t.memberCount} people`;
  return `${people} · active ${activityAgo(t.lastActivityAt, now)}`;
}

/**
 * Lays the bubbles out: the current Together in the middle, the rest on a golden-angle spiral around it (most recent
 * first), then nudged apart until none overlap. Deterministic, so the cluster looks the same on every visit.
 */
export function layoutBubbles(togethers: TogetherSummary[], now: number): Bubble[] {
  const ordered = [...togethers].sort(
    (a, b) => Number(b.current) - Number(a.current) || b.lastActivityAt.localeCompare(a.lastActivityAt) || a.id.localeCompare(b.id)
  );
  const golden = Math.PI * (3 - Math.sqrt(5));
  const bubbles: Bubble[] = ordered.map((t, i) => {
    const radius = bubbleRadius(t.lastActivityAt, now);
    const distance = i === 0 ? 0 : 1.6 * Math.sqrt(i);
    const angle = i * golden;
    return {
      id: t.id,
      name: t.name,
      detail: bubbleDetail(t, now),
      tone: bubbleTone(t.id),
      radius,
      // a little depth, so the cluster turns like a cluster when dragged
      position: [Math.cos(angle) * distance, Math.sin(angle) * distance, i === 0 ? 0 : ((i % 3) - 1) * 0.35],
      current: t.current,
      hasNews: t.hasNews,
    };
  });

  // push overlapping pairs apart; the first bubble stays put
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i] as Bubble;
        const b = bubbles[j] as Bubble;
        const dx = b.position[0] - a.position[0];
        const dy = b.position[1] - a.position[1];
        const dz = b.position[2] - a.position[2];
        const dist = Math.hypot(dx, dy, dz) || 0.001;
        const overlap = a.radius + b.radius + GAP - dist;
        if (overlap <= 0) continue;
        moved = true;
        const [ux, uy, uz] = dist === 0.001 ? [1, 0, 0] : [dx / dist, dy / dist, dz / dist];
        const share = i === 0 ? 1 : 0.5;
        b.position = [b.position[0] + ux * overlap * share, b.position[1] + uy * overlap * share, b.position[2] + uz * overlap * share];
        if (i !== 0) a.position = [a.position[0] - ux * overlap * 0.5, a.position[1] - uy * overlap * 0.5, a.position[2] - uz * overlap * 0.5];
      }
    }
    if (!moved) break;
  }
  return bubbles;
}

/** how far the camera needs to sit back to see the whole cluster */
export function clusterExtent(bubbles: Bubble[]): number {
  return bubbles.reduce((max, b) => Math.max(max, Math.hypot(b.position[0], b.position[1]) + b.radius), 1);
}
