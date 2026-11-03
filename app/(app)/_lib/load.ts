import "server-only";
import { redirect } from "next/navigation";
import { getTogether } from "@/lib/actions/together";
import type { DataResult, Together } from "@/lib/models";

/** The signed-in member's Together, or off to onboarding when they don't have one yet */
export async function requireTogether(): Promise<Together> {
  const { data, error } = await getTogether();
  if (error) throw new Error(`Couldn't load your Together: ${error}`);
  if (!data) redirect("/onboarding/together");
  return data;
}

/** unwraps a read for a page; the error boundary shows a failure */
export function must<T>(result: DataResult<T>, what: string): T {
  if (!result.data) throw new Error(`Couldn't load ${what}: ${result.error ?? "no data"}`);
  return result.data;
}
