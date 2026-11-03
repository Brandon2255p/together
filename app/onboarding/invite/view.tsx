"use client";

import { InviteScreen } from "@/components/onboarding/invite-screen";
import type { Together } from "@/lib/models";
import { useInviteViewModel } from "./view-model";

export function InviteView({ together }: { together: Together }) {
  const vm = useInviteViewModel(together);
  return (
    <div className="mx-auto max-w-[440px]">
      <InviteScreen {...vm} />
    </div>
  );
}
