import type { Metadata } from "next";
import { TogetherOnboardingView } from "./view";

export const metadata: Metadata = { title: "Start or join" };

export default function TogetherOnboardingPage() {
  return <TogetherOnboardingView />;
}
