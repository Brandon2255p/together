import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const iconButtonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center rounded-full transition-[transform,background-color] duration-200 active:scale-[0.92] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5",
  {
    variants: {
      variant: {
        surface: "border border-line bg-surface text-ink hover:bg-surface-muted",
        ink: "bg-ink text-on-accent shadow-float hover:bg-ink/90",
        glass: "bg-surface/85 text-ink backdrop-blur-md hover:bg-surface",
        ghost: "text-ink-muted hover:bg-surface-muted hover:text-ink",
      },
      size: {
        md: "size-11",
        lg: "size-14 [&_svg]:size-6",
        sm: "size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "surface", size: "md" },
  }
);

export type IconButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof iconButtonVariants> & {
    /** required: icon-only buttons need an accessible name */
    label: string;
  };

export function IconButton({ className, variant, size, label, children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </button>
  );
}
