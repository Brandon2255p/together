"use client";

import { SignInScreen } from "@/components/auth/sign-in-screen";
import { useSignInViewModel } from "./view-model";

export function SignInView({ next }: { next: string | null }) {
  const vm = useSignInViewModel(next);
  return <SignInScreen {...vm} />;
}
