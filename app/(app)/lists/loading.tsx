import { ScreenSkeleton } from "@/components/ui/skeleton";

/** shows the moment the tab is tapped, while the page loads its data */
export default function Loading() {
  return <ScreenSkeleton title="Lists" segmented rows={5} />;
}
