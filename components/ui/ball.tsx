"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * The same smooth ball as a CSS gradient: what shows while three.js loads, instead of it when motion is reduced, and
 * the flat bubbles on the reduced-motion grid. Light from the top left, like the 3D one.
 */
export function ballGradient([a, b, c]: readonly [string, string, string]) {
  return `radial-gradient(circle at 34% 28%, #ffffff 0%, ${c} 14%, ${b} 46%, ${a} 100%)`;
}

const BallScene = dynamic(() => import("@/components/ui/ball-scene"), { ssr: false, loading: () => null });

/**
 * A smooth, glossy 3D ball (three.js) that breathes and floats: a Together's bubble outside the cluster, such as the
 * Opening overlay and the loading skeletons. Decorative: hidden from assistive tech.
 */
export function Ball({
  colors,
  speed = 1,
  className,
}: {
  /** base, lighter, highlight */
  colors: readonly [string, string, string];
  speed?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [a, b, c] = colors;
  return (
    <div aria-hidden className={cn("pointer-events-none relative", className)}>
      {/* the 3D ball fills about 89% of its canvas; the flat one matches it until three.js takes over */}
      <div className="absolute inset-[5.5%] rounded-full" style={{ background: ballGradient(colors) }} />
      {reduced ? null : (
        <div className="absolute inset-0">
          <BallScene colors={[a, b, c]} speed={speed} />
        </div>
      )}
    </div>
  );
}
