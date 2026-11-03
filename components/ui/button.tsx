import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-full font-semibold transition-[transform,background-color,color,opacity] duration-200 ease-(--ease-out-soft) active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-ink text-on-accent hover:bg-ink/90",
        accent: "bg-accent text-on-accent hover:bg-accent/90",
        soft: "bg-surface-muted text-ink hover:bg-line",
        outline: "border border-line bg-surface text-ink hover:bg-surface-muted",
        ghost: "text-ink-muted hover:text-ink",
      },
      size: {
        lg: "h-[54px] px-6 text-body-strong",
        md: "h-11 px-5 text-callout",
        sm: "h-9 px-3.5 text-caption",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "lg", block: false },
  }
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** shows a spinner and disables the button */
    pending?: boolean;
  };

export function Button({ className, variant, size, block, pending, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? <LoaderCircleIcon className="size-5 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
