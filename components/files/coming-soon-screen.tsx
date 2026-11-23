"use client";

import Link from "next/link";
import type { Route } from "next";
import { ChevronLeftIcon, FolderIcon, ImagesIcon } from "lucide-react";
import { iconButtonVariants } from "@/components/ui/icon-button";
import { EmptyState, ScreenHeader } from "@/components/ui/layout";
import { Reveal, RevealItem } from "@/components/ui/motion";

export interface ComingSoonScreenProps {
  back: Route;
  title: string;
  kind: "gallery" | "files";
  body: string;
}

/** Gallery and Files, reachable from Home's shortcuts while the real screens are being built */
export function ComingSoonScreen({ back, title, kind, body }: ComingSoonScreenProps) {
  return (
    <Reveal className="flex flex-col gap-5">
      <RevealItem className="flex flex-col gap-4">
        <div className="flex items-center">
          <Link href={back} aria-label="Back to Home" className={iconButtonVariants({ variant: "surface" })}>
            <ChevronLeftIcon aria-hidden />
          </Link>
        </div>
        <ScreenHeader title={title} />
      </RevealItem>
      <RevealItem>
        <EmptyState icon={kind === "gallery" ? <ImagesIcon aria-hidden /> : <FolderIcon aria-hidden />} title="Coming soon" body={body} />
      </RevealItem>
    </Reveal>
  );
}
