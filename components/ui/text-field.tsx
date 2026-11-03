import { cn } from "@/lib/utils";

/** A single-line input with an optional leading icon and trailing slot. The label is visually hidden. */
export function TextField({
  label,
  icon,
  trailing,
  className,
  inputClassName,
  ...props
}: React.ComponentProps<"input"> & {
  label: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  inputClassName?: string;
}) {
  return (
    <label
      className={cn(
        "flex h-14 items-center gap-3 rounded-field border border-line bg-surface px-[18px] transition-[border-color,box-shadow] duration-200",
        "focus-within:border-ink focus-within:shadow-[0_0_0_1px_var(--color-ink)]",
        "[&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:text-ink-muted focus-within:[&>svg]:text-ink",
        className
      )}
    >
      <span className="sr-only">{label}</span>
      {icon}
      <input
        className={cn(
          "min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-subtle",
          inputClassName
        )}
        {...props}
      />
      {trailing}
    </label>
  );
}
