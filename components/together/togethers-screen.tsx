"use client";

import dynamic from "next/dynamic";
import { NavLink } from "@/components/ui/nav-link";
import type { Route } from "next";
import { useReducedMotion } from "motion/react";
import { ChevronLeftIcon, HeartIcon, LinkIcon, PlusIcon } from "lucide-react";
import type { Bubble } from "@/lib/together/bubbles";
import { Button } from "@/components/ui/button";
import { iconButtonVariants } from "@/components/ui/icon-button";
import { InlineError, ScreenHeader } from "@/components/ui/layout";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/utils";
import { TONE_COLORS } from "./bubble-palette";
import { ballGradient } from "@/components/ui/ball";
import { OpeningOverlay } from "./together-skeletons";

const BubbleScene = dynamic(() => import("@/components/together/bubble-scene"), { ssr: false, loading: () => null });

export interface TogethersScreenProps {
  back: Route;
  bubbles: Bubble[];
  /** how far out the cluster reaches, for the camera */
  extent: number;
  /** the bubble being opened, while the switch is saved */
  opening: string | null;
  onPick: (id: string) => void;
  sheet: "join" | "create" | null;
  onSheetChange: (sheet: "join" | "create" | null) => void;
  code: string;
  onCodeChange: (code: string) => void;
  onJoin: () => void;
  newName: string;
  onNewNameChange: (name: string) => void;
  onCreate: () => void;
  pending: boolean;
  error: string | null;
  /** set when you're in as many Togethers as you can be: why Join and Start are off */
  atLimit: string | null;
}

/** a bubble without three.js: the same gradient as a flat circle */
function FlatBubble({ bubble, onPick, opening }: { bubble: Bubble; onPick: (id: string) => void; opening: boolean }) {
  const size = Math.round(72 + bubble.radius * 56);
  return (
    <button
      type="button"
      onClick={() => onPick(bubble.id)}
      className={cn("flex flex-col items-center gap-2 text-center", opening && "opacity-60")}
      aria-current={bubble.current || undefined}
    >
      <span
        className="relative rounded-full"
        style={{ width: size, height: size, background: ballGradient(TONE_COLORS[bubble.tone]) }}
      >
        {bubble.hasNews ? <span className="absolute top-1 right-1 size-3 rounded-full bg-accent ring-2 ring-bg" /> : null}
      </span>
      <span className="text-callout font-semibold">{bubble.name}</span>
      <span className="text-caption text-ink-muted">{bubble.current ? "You're here" : bubble.detail}</span>
    </button>
  );
}

/** Screen 17: every Together you're in, as bubbles sized by recent activity. Tap one to switch to it. */
export function TogethersScreen(props: TogethersScreenProps) {
  const { back, bubbles, extent, opening, onPick, sheet, onSheetChange, pending, error, atLimit } = props;
  const reduced = useReducedMotion();
  const openingBubble = bubbles.find((b) => b.id === opening);

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col gap-5">
      {openingBubble ? <OpeningOverlay name={openingBubble.name} colors={TONE_COLORS[openingBubble.tone]} /> : null}
      <NavLink href={back} aria-label="Back to Home" className={iconButtonVariants({ variant: "surface", size: "md" })}>
        <ChevronLeftIcon aria-hidden />
      </NavLink>
      <ScreenHeader eyebrow={`${bubbles.length} Together${bubbles.length === 1 ? "" : "s"}`} title="Your Togethers" />
      <p className="-mt-3 text-callout text-ink-muted">Bigger bubbles have more going on. Tap one to open it.</p>

      {reduced ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 py-2">
          {bubbles.map((b) => (
            <FlatBubble key={b.id} bubble={b} onPick={onPick} opening={opening === b.id} />
          ))}
        </div>
      ) : (
        <>
          <div className="relative -mx-5 h-[min(50dvh,460px)]" aria-hidden>
            <BubbleScene bubbles={bubbles} extent={extent} onPick={onPick} />
          </div>
          {/* the canvas is for looking at; these are for keyboards and screen readers */}
          <ul className="sr-only">
            {bubbles.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => onPick(b.id)} aria-current={b.current || undefined}>
                  {b.name}, {b.current ? "open now" : b.detail}
                  {b.hasNews ? ", something new" : ""}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* pinned to the bottom of the screen, so they're there however tall the bubbles are */}
      <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] mt-auto flex flex-col gap-2 bg-bg pt-2">
        <InlineError>{sheet ? null : error}</InlineError>
        {atLimit ? <p className="text-center text-caption text-ink-muted">{atLimit}</p> : null}
        <div className="flex gap-2">
          <Button variant="outline" size="md" className="flex-1" disabled={atLimit !== null} onClick={() => onSheetChange("join")}>
            <LinkIcon className="size-4" aria-hidden />
            Join one
          </Button>
          <Button size="md" className="flex-1" disabled={atLimit !== null} onClick={() => onSheetChange("create")}>
            <PlusIcon className="size-4" aria-hidden />
            Start new
          </Button>
        </div>
      </div>

      <Sheet open={sheet === "join"} onOpenChange={(open) => onSheetChange(open ? "join" : null)} title="Join a Together">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            props.onJoin();
          }}
        >
          <p className="text-callout text-ink-muted">Enter the 6-letter code someone sent you.</p>
          <TextField
            label="Invite code"
            placeholder="e.g. K7Q-29X"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            icon={<LinkIcon aria-hidden />}
            value={props.code}
            onChange={(e) => props.onCodeChange(e.target.value)}
          />
          <InlineError>{error}</InlineError>
          <Button type="submit" block pending={pending}>
            Join
          </Button>
        </form>
      </Sheet>

      <Sheet open={sheet === "create"} onOpenChange={(open) => onSheetChange(open ? "create" : null)} title="Start a Together">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            props.onCreate();
          }}
        >
          <p className="text-callout text-ink-muted">For a partner, a family, a flat: anyone you share lists and plans with.</p>
          <TextField
            label="Name"
            placeholder="e.g. The flat"
            icon={<HeartIcon aria-hidden />}
            maxLength={60}
            value={props.newName}
            onChange={(e) => props.onNewNameChange(e.target.value)}
          />
          <InlineError>{error}</InlineError>
          <Button type="submit" block pending={pending}>
            Start it
          </Button>
        </form>
      </Sheet>
    </div>
  );
}
