"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AppTab } from "@/components/layout/app-shell";
import { browserBackend } from "@/lib/backend/browser";

const TABS: AppTab[] = ["home", "lists", "calendar", "places", "wishlist"];
/** a burst of changes (a chore and its assignees, say) becomes one refresh */
const SETTLE_MS = 400;

/**
 * Live sync: when anything in the Together changes, the page reloads its data from the server (`router.refresh()`
 * keeps client state like open sheets; view-models take the new data through useServerState). A tab that was in
 * the background catches up when it's shown again.
 */
function useLiveTogether() {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let missed = false;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.visibilityState === "hidden") {
          missed = true;
          return;
        }
        router.refresh();
      }, SETTLE_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && missed) {
        missed = false;
        router.refresh();
      }
    };
    const stop = browserBackend.watchTogether(refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
}

/** which tab the URL is under (routing stays out of the components) */
export function useAppShellViewModel() {
  useLiveTogether();
  const segment = usePathname().split("/")[1] ?? "";
  const active = (TABS as string[]).includes(segment) ? (segment as AppTab) : null;
  return { active };
}
