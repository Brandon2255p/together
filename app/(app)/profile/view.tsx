"use client";

import { ProfileScreen } from "@/components/profile/profile-screen";
import type { Together } from "@/lib/models";
import { useProfileViewModel } from "./view-model";

export function ProfileView({ together }: { together: Together }) {
  const vm = useProfileViewModel(together);
  return <ProfileScreen {...vm} />;
}
