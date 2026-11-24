import Link from "next/link";
import type { Route } from "next";
import { IconBadge } from "@/components/ui/layout";

/**
 * One of Home's square shortcut cards (Calendar, Challenges, Gallery, Files, Switch, Manage): an icon in a soft circle
 * over its name. `dot` marks news behind it (another Together has something new).
 */
export function ShortcutCard({
  href,
  icon,
  tone,
  label,
  ariaLabel,
  dot = false,
}: {
  href: Route;
  icon: React.ReactNode;
  tone: "accent" | "partner" | "success" | "warning";
  label: string;
  /** when the label alone doesn't say enough ("Switch" → which Together you're in) */
  ariaLabel?: string;
  dot?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="relative flex aspect-square min-w-0 flex-col items-center justify-center gap-2 rounded-3xl bg-surface px-1 transition-transform active:scale-[0.97]"
    >
      <IconBadge tone={tone} size="lg" className="size-13 [&_svg]:size-6">
        {icon}
      </IconBadge>
      <span className="w-full truncate text-center text-caption text-ink">{label}</span>
      {dot ? <span aria-hidden className="absolute top-3 right-3 size-2.5 rounded-full bg-accent ring-2 ring-surface" /> : null}
    </Link>
  );
}
