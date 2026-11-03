import type { Metadata } from "next";
import { DesignSystemView } from "./view";

export const metadata: Metadata = { title: "Design system" };

export default function DesignSystemPage() {
  return <DesignSystemView />;
}
