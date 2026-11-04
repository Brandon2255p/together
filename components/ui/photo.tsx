"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A decorative photo that fills its (relative) parent and fades in once loaded. If it fails, it disappears and
 * whatever is behind it (a gradient, an icon) shows instead.
 */
export function Photo({ src, sizes, priority, className }: { src: string; sizes: string; priority?: boolean; className?: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  if (state === "failed") return null;
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      unoptimized
      priority={priority}
      onLoad={() => setState("loaded")}
      onError={() => setState("failed")}
      className={cn("object-cover transition-opacity duration-500", state === "loaded" ? "opacity-100" : "opacity-0", className)}
    />
  );
}
