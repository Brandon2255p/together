import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge has to know about our custom type utilities (app/globals.css), or it mistakes
 * `text-body-strong` for a text colour and drops the real colour class (e.g. `text-on-accent`).
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["display-xl", "display-l", "title", "body-strong", "body", "callout", "caption", "overline"] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
