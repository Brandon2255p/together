import { PlaceFormSkeleton } from "@/components/places/place-form-skeleton";

/** "Add a place" or "Change place" (?replace=) isn't known here, so the title is a placeholder */
export default function Loading() {
  return <PlaceFormSkeleton search />;
}
