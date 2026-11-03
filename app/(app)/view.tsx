"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useAppShellViewModel } from "./view-model";

export function AppShellView({ children }: { children: React.ReactNode }) {
  const { active } = useAppShellViewModel();
  return <AppShell active={active}>{children}</AppShell>;
}
