"use client";

import { DesignSystemScreen } from "@/components/design-system/design-system-screen";
import { useDesignSystemViewModel } from "./view-model";

export function DesignSystemView() {
  const vm = useDesignSystemViewModel();
  return <DesignSystemScreen {...vm} />;
}
