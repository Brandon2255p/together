"use client";

import { VerifyScreen } from "@/components/auth/verify-screen";
import { useVerifyViewModel } from "./view-model";

export function VerifyView() {
  const vm = useVerifyViewModel();
  return <VerifyScreen {...vm} />;
}
