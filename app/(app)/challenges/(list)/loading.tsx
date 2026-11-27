import { ScreenSkeleton } from "@/components/ui/skeleton";

/** shows the moment Challenges is opened, while the challenges load */
export default function Loading() {
  return <ScreenSkeleton title="Challenges" back="button" card rows={3} />;
}
