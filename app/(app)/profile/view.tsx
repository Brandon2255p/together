"use client";

import { ProfileScreen } from "@/components/profile/profile-screen";
import type { Together } from "@/lib/models";
import { useProfileViewModel } from "./view-model";

export function ProfileView({ together, vapidPublicKey }: { together: Together; vapidPublicKey: string | null }) {
  const vm = useProfileViewModel(together, vapidPublicKey);
  return <ProfileScreen {...vm} />;
}
