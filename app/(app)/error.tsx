"use client";

import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/layout";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      className="mt-10"
      icon={<RefreshCwIcon aria-hidden />}
      title="That didn't load"
      body={error.message}
      action={
        <Button size="md" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
