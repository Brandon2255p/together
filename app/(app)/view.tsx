"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useAppShellViewModel } from "./view-model";

export function AppShellView({ children }: { children: React.ReactNode }) {
  const { active, tabBar } = useAppShellViewModel();
  return (
    <AppShell active={active} tabBar={tabBar}>
      {children}
    </AppShell>
  );
}
