import Link from "next/link";
import type { Route } from "next";
import { IconBadge } from "@/components/ui/layout";

/** One of Home's big shortcut cards (Calendar, Challenges, Gallery, Files): an icon in a soft circle over its name */
export function ShortcutCard({
  href,
  icon,
  tone,
  label,
}: {
  href: Route;
  icon: React.ReactNode;
  tone: "accent" | "partner" | "success" | "warning";
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 flex-1 flex-col items-center gap-2 rounded-3xl bg-surface px-1 py-3.5 transition-transform active:scale-[0.97]"
    >
      <IconBadge tone={tone} size="lg" className="size-13 [&_svg]:size-6">
        {icon}
      </IconBadge>
      <span className="w-full truncate text-center text-caption text-ink">{label}</span>
    </Link>
  );
}
