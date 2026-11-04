import type { Metadata } from "next";
import { SignInView } from "./view";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next } = await searchParams;
  return <SignInView next={typeof next === "string" ? next : null} />;
}
