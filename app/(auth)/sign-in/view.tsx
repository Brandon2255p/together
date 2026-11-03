"use client";

import { SignInScreen } from "@/components/auth/sign-in-screen";
import { useSignInViewModel } from "./view-model";

export function SignInView() {
  const vm = useSignInViewModel();
  return <SignInScreen {...vm} />;
}
