import { AppShellView } from "./view";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShellView>{children}</AppShellView>;
}
