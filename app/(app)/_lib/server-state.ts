"use client";

import { useState } from "react";

/**
 * State that starts from what the server page loaded, and starts over whenever the page loads it again (after
 * `router.refresh()`, for instance when the other person changed something). Between loads it's ordinary state, so
 * view-models can update it optimistically.
 */
export function useServerState<T>(server: T) {
  const [state, setState] = useState(server);
  const [loaded, setLoaded] = useState(server);
  if (loaded !== server) {
    // React's way to adjust state when a prop changes: during render, not in an effect
    setLoaded(server);
    setState(server);
  }
  return [state, setState] as const;
}
