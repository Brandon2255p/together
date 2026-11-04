import { EllipsisIcon } from "lucide-react";
import type { Member } from "@/lib/models";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

/**
 * A person in a Together (Figma: Member Row). `detail` is the line under the name ("You", "Joined March").
 * The ••• button only shows when `onActions` is given (owners, on other people's rows).
 */
export function MemberRow({
  member,
  detail,
  onActions,
  className,
}: {
  member: Pick<Member, "name" | "initial" | "tone" | "role">;
  detail?: string;
  onActions?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-row bg-surface px-4 py-3", className)}>
      <Avatar member={member} size="lg" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="truncate text-body-strong">{member.name}</span>
          {member.role === "owner" ? <Chip tone="accent">Owner</Chip> : null}
        </span>
        {detail ? <span className="truncate text-caption text-ink-muted">{detail}</span> : null}
      </span>
      {onActions ? (
        <IconButton label={`Options for ${member.name}`} variant="ghost" size="sm" onClick={onActions}>
          <EllipsisIcon />
        </IconButton>
      ) : null}
    </div>
  );
}
