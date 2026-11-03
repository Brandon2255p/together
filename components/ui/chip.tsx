import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const chipVariants = cva(
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-chip px-2.5 py-1 text-caption [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "bg-surface-muted text-ink-muted",
        accent: "bg-accent-soft text-accent-ink",
        partner: "bg-partner-soft text-partner-ink",
        success: "bg-success-soft text-success-ink",
        warning: "bg-warning-soft text-warning-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export type ChipTone = NonNullable<VariantProps<typeof chipVariants>["tone"]>;

export function Chip({
  tone,
  className,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return <span className={cn(chipVariants({ tone }), className)} {...props} />;
}

/** A selectable pill (filters, quick picks). Controlled. */
export function PillButton({
  selected,
  className,
  ...props
}: React.ComponentProps<"button"> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip px-3.5 py-2 text-caption transition-colors duration-200 [&_svg]:size-3.5",
        selected ? "bg-ink text-on-accent" : "border border-line bg-surface text-ink-muted hover:text-ink",
        className
      )}
      {...props}
    />
  );
}
