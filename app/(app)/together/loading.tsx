import { TogetherSkeleton } from "@/components/together/together-skeletons";

/** shows the moment the Together is opened, while its members and invite code load */
export default function Loading() {
  return <TogetherSkeleton />;
}
