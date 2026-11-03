"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const PALETTES = {
  together: ["#ff6b4a", "#6c7bff", "#ffc7a8"],
  warm: ["#ff6b4a", "#ffb08f", "#ffd9c2"],
  cool: ["#6c7bff", "#a3acff", "#ffc7a8"],
} as const satisfies Record<string, readonly [string, string, string]>;

export type OrbPalette = keyof typeof PALETTES;

/** The static look: what shows while three.js loads, and instead of it when motion is reduced */
function OrbFallback({ palette }: { palette: OrbPalette }) {
  const [a, b] = PALETTES[palette];
  return (
    <div
      className="size-full rounded-full"
      style={{ background: `radial-gradient(circle at 35% 35%, ${a}, transparent 60%), radial-gradient(circle at 70% 65%, ${b}, transparent 55%)` }}
    />
  );
}

const OrbScene = dynamic(() => import("@/components/ui/orb-scene"), {
  ssr: false,
  loading: () => null,
});

/**
 * The slowly morphing gradient blob (three.js) behind hero moments: sign-in, invite, the "Up next" card.
 * It leans toward the pointer/touch. Decorative: hidden from assistive tech.
 */
export function Orb({
  palette = "together",
  speed = 1,
  blur = true,
  className,
}: {
  palette?: OrbPalette;
  speed?: number;
  /** soften it into a glow (the Figma look) */
  blur?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [a, b, c] = PALETTES[palette];
  return (
    <div aria-hidden className={cn("pointer-events-none relative", blur && "blur-2xl", className)}>
      <div className="absolute inset-0 opacity-60">
        <OrbFallback palette={palette} />
      </div>
      {reduced ? null : (
        <div className="absolute inset-0">
          <OrbScene colors={[a, b, c]} speed={speed} />
        </div>
      )}
    </div>
  );
}
