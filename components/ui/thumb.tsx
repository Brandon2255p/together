import { StarIcon } from "lucide-react";
import type { Hue } from "@/lib/models";
import { Photo } from "@/components/ui/photo";
import { cn } from "@/lib/utils";

const GRADIENTS: Record<Hue, string> = {
  accent: "from-[#ff8c6b] to-[#ffd1b3]",
  partner: "from-[#7480ff] to-[#c8ccff]",
  success: "from-[#35a878] to-[#bfeacd]",
  warning: "from-[#e59e2e] to-[#ffe1ad]",
};

/** A photo tile, or a soft gradient with an icon standing in for one (places, wishes) */
export function Thumb({
  hue,
  icon,
  src,
  className,
}: {
  hue: Hue;
  icon: React.ReactNode;
  /** the photo; the gradient shows while it loads and if there's none */
  src?: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid size-[68px] shrink-0 place-items-center overflow-hidden rounded-[18px] bg-linear-135 text-on-accent [&_svg]:size-6",
        GRADIENTS[hue],
        className
      )}
    >
      {icon}
      {src ? <Photo src={src} sizes="68px" /> : null}
    </span>
  );
}

/** A star and a score, e.g. 4.5 */
export function Rating({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-caption text-ink", className)}>
      <StarIcon className="size-3.5 fill-warning text-warning" aria-hidden />
      <span>
        <span className="sr-only">Rated </span>
        {value.toFixed(1)}
      </span>
    </span>
  );
}
