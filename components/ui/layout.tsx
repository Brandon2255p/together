import { cn } from "@/lib/utils";

/** The big serif page title with an optional small line above it and actions on the right */
export function ScreenHeader({
  title,
  eyebrow,
  actions,
  className,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-end justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        {eyebrow ? <p className="text-caption text-ink-muted">{eyebrow}</p> : null}
        <h1 className="text-display-l text-balance">{title}</h1>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** The small uppercase label above a group of rows */
export function SectionHeader({
  title,
  action,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="text-overline text-ink-muted">{title}</h2>
      {action ? <div className="text-caption text-ink-muted [&_a]:hover:text-ink [&_button]:hover:text-ink">{action}</div> : null}
    </div>
  );
}

/** A white rounded surface */
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-card bg-surface p-5", className)} {...props} />;
}

/** A coloured circle holding an icon (tiles, option cards) */
export function IconBadge({
  tone = "accent",
  size = "md",
  className,
  children,
}: {
  tone?: "accent" | "partner" | "success" | "warning" | "ink";
  size?: "md" | "lg";
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    accent: "bg-accent-soft text-accent-ink",
    partner: "bg-partner-soft text-partner-ink",
    success: "bg-success-soft text-success-ink",
    warning: "bg-warning-soft text-warning-ink",
    ink: "bg-ink text-on-accent",
  } as const;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full",
        size === "md" ? "size-10 [&_svg]:size-5" : "size-12 [&_svg]:size-[22px]",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Explains an empty list and offers the next step */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-10 text-center", className)}>
      <IconBadge tone="accent" size="lg">
        {icon}
      </IconBadge>
      <div className="flex flex-col gap-1">
        <p className="text-body-strong">{title}</p>
        {body ? <p className="text-callout text-ink-muted">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** An inline error the view-model reports (failed save, bad code) */
export function InlineError({ children, className }: { children?: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className={cn("rounded-2xl bg-accent-soft px-4 py-3 text-caption text-accent-ink", className)}>
      {children}
    </p>
  );
}
