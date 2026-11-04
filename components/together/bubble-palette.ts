import type { MemberTone } from "@/lib/models";

/** each tone's bubble gradient: base, lighter, highlight. Shared by the 3D scene and the flat (reduced motion) grid. */
export const TONE_COLORS: Record<MemberTone, [string, string, string]> = {
  accent: ["#ff6b4a", "#ffb08f", "#ffd9c2"],
  partner: ["#6c7bff", "#a3acff", "#dfe3ff"],
  success: ["#2fa572", "#8fd6b4", "#ddf3e8"],
  warning: ["#e39b2d", "#f5c77e", "#fcefd9"],
};
