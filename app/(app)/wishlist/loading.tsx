import { ScreenSkeleton } from "@/components/ui/skeleton";

/** shows the moment the tab is tapped, while the page loads its data */
export default function Loading() {
  return <ScreenSkeleton title="Wishlist" segmented rows={4} />;
}
