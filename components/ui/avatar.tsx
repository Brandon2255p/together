import type { Member, MemberTone } from "@/lib/models";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-6 text-[11px]",
  md: "size-8 text-[13px]",
  lg: "size-10 text-[15px]",
  xl: "size-[84px] text-[34px]",
} as const;

/** each member's colour, in join order: the Figma Member Avatar's Tone */
export const TONE_BG: Record<MemberTone, string> = {
  accent: "bg-accent",
  partner: "bg-partner",
  success: "bg-success",
  warning: "bg-warning",
};

export type AvatarSize = keyof typeof SIZES;

export function Avatar({
  member,
  size = "md",
  className,
}: {
  member: Pick<Member, "name" | "initial" | "tone">;
  size?: AvatarSize;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={member.name}
      title={member.name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-on-accent ring-2 ring-surface",
        SIZES[size],
        TONE_BG[member.tone],
        className
      )}
    >
      {member.initial}
    </span>
  );
}

/** Overlapping avatars, e.g. the people a chore is shared with */
export function AvatarStack({
  members,
  size = "md",
  className,
}: {
  members: Pick<Member, "id" | "name" | "initial" | "tone">[];
  size?: AvatarSize;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center", size === "lg" ? "-space-x-2.5" : "-space-x-2", className)}>
      {members.map((m) => (
        <Avatar key={m.id} member={m} size={size} />
      ))}
    </span>
  );
}
