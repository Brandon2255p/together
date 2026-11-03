import type { Metadata } from "next";
import { VerifyView } from "./view";

export const metadata: Metadata = { title: "Check your inbox" };

export default function VerifyPage() {
  return <VerifyView />;
}
