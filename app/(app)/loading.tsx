import { ScreenSkeleton } from "@/components/ui/skeleton";

/**
 * The safety net: any screen without its own loading.tsx still changes the moment it's tapped. Every screen that
 * loads data should have its own, shaped like it. A list screen with routes under it keeps its page and loading.tsx
 * in a route group (challenges/(list), places/(list)…) so its skeleton doesn't also cover the screens below.
 */
export default function Loading() {
  return <ScreenSkeleton rows={4} />;
}
