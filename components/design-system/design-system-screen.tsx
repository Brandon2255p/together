"use client";

import {
  CalendarIcon,
  HeartIcon,
  HouseIcon,
  ListChecksIcon,
  MapPinIcon,
  PlusIcon,
  RepeatIcon,
  SearchIcon,
  SparklesIcon,
  UtensilsIcon,
} from "lucide-react";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip, PillButton } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Card, EmptyState, IconBadge, InlineError, ScreenHeader, SectionHeader } from "@/components/ui/layout";
import { Orb } from "@/components/ui/orb";
import { OtpInput } from "@/components/ui/otp-input";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { TabBar } from "@/components/ui/tab-bar";
import { TaskRow } from "@/components/ui/task-row";
import { TextField } from "@/components/ui/text-field";
import { Rating, Thumb } from "@/components/ui/thumb";
import type { Member } from "@/lib/models";

const BRANDON: Member = { id: "b", name: "Brandon", initial: "B", tone: "accent", role: "owner" };
const ADELE: Member = { id: "a", name: "Adele", initial: "A", tone: "partner", role: "member" };

const COLOURS = [
  ["bg", "#FBF8F4"],
  ["surface", "#FFFFFF"],
  ["surface-muted", "#F4EFE9"],
  ["line", "#ECE5DE"],
  ["ink", "#1F1A17"],
  ["ink-muted", "#7A706A"],
  ["ink-subtle", "#B5ACA5"],
  ["accent", "#FF6B4A"],
  ["accent-soft", "#FFE8E1"],
  ["accent-ink", "#C2401F"],
  ["partner", "#6C7BFF"],
  ["partner-soft", "#E7EAFF"],
  ["partner-ink", "#4250D1"],
  ["success", "#2FA572"],
  ["success-soft", "#DDF3E8"],
  ["warning", "#E39B2D"],
  ["warning-soft", "#FCEFD9"],
] as const;

const TYPE = [
  ["text-display-xl", "Display XL · 44/46 Instrument Serif"],
  ["text-display-l", "Display L · 34/38 Instrument Serif"],
  ["text-title", "Title · 20/26 Figtree semibold"],
  ["text-body-strong", "Body strong · 16/22"],
  ["text-body", "Body · 16/22"],
  ["text-callout", "Callout · 15/20"],
  ["text-caption", "Caption · 13/18"],
  ["text-overline", "Overline · 11/14"],
] as const;

const RADII = ["rounded-chip", "rounded-field", "rounded-row", "rounded-card", "rounded-sheet"] as const;

export interface DesignSystemScreenProps {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  rowDone: boolean;
  onRowDoneChange: (v: boolean) => void;
  segment: "shopping" | "chores";
  onSegmentChange: (v: "shopping" | "chores") => void;
  pill: string;
  onPillChange: (v: string) => void;
  otp: string;
  onOtpChange: (v: string) => void;
  otpInvalid: boolean;
  sheetOpen: boolean;
  onSheetOpenChange: (v: boolean) => void;
  text: string;
  onTextChange: (v: string) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-8">
      <h2 className="text-display-l">{title}</h2>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-overline text-ink-muted uppercase">{children}</p>;
}

export function DesignSystemScreen(p: DesignSystemScreenProps) {
  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-10 px-5 pt-10 pb-40">
      <header className="flex items-center justify-between gap-6">
        <div>
          <p className="text-overline text-ink-muted uppercase">Together</p>
          <h1 className="text-display-xl">Design system</h1>
          <p className="mt-2 text-callout text-ink-muted">
            Tokens and components from the Figma file. Everything here lives in <code>components/ui</code>.
          </p>
        </div>
        <Orb className="size-28 shrink-0" />
      </header>

      <Section title="Colour">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLOURS.map(([name, hex]) => (
            <div key={name} className="flex items-center gap-3 rounded-row border border-line bg-surface p-2.5">
              <span className="size-10 shrink-0 rounded-[12px] border border-line" style={{ background: hex }} />
              <div className="min-w-0">
                <p className="truncate text-callout font-semibold">{name}</p>
                <p className="text-caption text-ink-muted">{hex}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <div className="flex flex-col gap-3">
          {TYPE.map(([cls, label]) => (
            <p key={cls} className={cls}>
              {label}
            </p>
          ))}
        </div>
      </Section>

      <Section title="Radius & shadow">
        <div className="flex flex-wrap gap-3">
          {RADII.map((r) => (
            <div key={r} className={`grid h-20 w-28 place-items-center border border-line bg-surface ${r}`}>
              <span className="text-caption text-ink-muted">{r.replace("rounded-", "")}</span>
            </div>
          ))}
          <div className="grid h-20 w-28 place-items-center rounded-card bg-surface shadow-card">
            <span className="text-caption text-ink-muted">shadow-card</span>
          </div>
          <div className="grid h-20 w-28 place-items-center rounded-card bg-surface shadow-float">
            <span className="text-caption text-ink-muted">shadow-float</span>
          </div>
        </div>
      </Section>

      <Section title="Buttons">
        <Label>Variants</Label>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="soft">Soft</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
        <Label>Sizes & states</Label>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">Large</Button>
          <Button size="md">Medium</Button>
          <Button size="sm">Small</Button>
          <Button size="md" pending>
            Saving
          </Button>
          <Button size="md" disabled>
            Disabled
          </Button>
        </div>
        <Label>Icon buttons</Label>
        <div className="flex flex-wrap items-center gap-3">
          <IconButton label="Add">
            <PlusIcon />
          </IconButton>
          <IconButton label="Add" variant="ink">
            <PlusIcon />
          </IconButton>
          <span className="rounded-card bg-linear-135 from-accent to-partner p-2">
            <IconButton label="Add" variant="glass">
              <PlusIcon />
            </IconButton>
          </span>
          <IconButton label="Add" variant="ghost">
            <PlusIcon />
          </IconButton>
          <IconButton label="Add" size="sm">
            <PlusIcon />
          </IconButton>
          <IconButton label="Add" size="lg" variant="ink">
            <PlusIcon />
          </IconButton>
        </div>
      </Section>

      <Section title="Chips & pills">
        <div className="flex flex-wrap gap-2">
          <Chip>Neutral</Chip>
          <Chip tone="accent">Today</Chip>
          <Chip tone="partner">
            <RepeatIcon /> Weekly
          </Chip>
          <Chip tone="success">Done</Chip>
          <Chip tone="warning">Overdue</Chip>
        </div>
        <div className="flex flex-wrap gap-2">
          {["all", "mine", "adele", "shared"].map((v) => (
            <PillButton key={v} selected={p.pill === v} onClick={() => p.onPillChange(v)}>
              {v[0]?.toUpperCase() + v.slice(1)}
            </PillButton>
          ))}
        </div>
      </Section>

      <Section title="Avatars">
        <div className="flex items-center gap-3">
          <Avatar member={BRANDON} size="sm" />
          <Avatar member={BRANDON} size="md" />
          <Avatar member={ADELE} size="lg" />
          <Avatar member={ADELE} size="xl" />
          <AvatarStack members={[BRANDON, ADELE]} size="lg" />
        </div>
      </Section>

      <Section title="Inputs">
        <TextField
          label="Add an item"
          placeholder="Add an item…"
          icon={<SearchIcon />}
          value={p.text}
          onChange={(e) => p.onTextChange(e.target.value)}
        />
        <Segmented
          label="List"
          value={p.segment}
          onValueChange={p.onSegmentChange}
          options={[
            { value: "shopping", label: "Shopping" },
            { value: "chores", label: "Chores" },
          ]}
        />
        <Segmented
          label="List"
          size="sm"
          value={p.segment}
          onValueChange={p.onSegmentChange}
          options={[
            { value: "shopping", label: "Shopping" },
            { value: "chores", label: "Chores" },
          ]}
        />
        <div className="flex items-center gap-3">
          <Checkbox checked={p.checked} onCheckedChange={p.onCheckedChange} label="Demo checkbox" />
          <span className="text-callout text-ink-muted">Checkbox</span>
        </div>
        <Label>OTP (000000 shows the invalid state)</Label>
        <OtpInput value={p.otp} onChange={p.onOtpChange} invalid={p.otpInvalid} />
      </Section>

      <Section title="Rows & cards">
        <TaskRow
          title="Take the bins out"
          done={p.rowDone}
          onDoneChange={p.onRowDoneChange}
          meta={
            <Chip tone="accent">
              <RepeatIcon /> Every Tuesday
            </Chip>
          }
          people={[BRANDON, ADELE]}
        />
        <Card className="flex items-center gap-4 p-4">
          <Thumb hue="accent" icon={<UtensilsIcon />} />
          <div className="min-w-0 flex-1">
            <p className="text-body-strong">Nobu</p>
            <p className="text-caption text-ink-muted">Japanese · V&amp;A Waterfront</p>
            <Rating value={4.5} className="mt-1" />
          </div>
        </Card>
        <div className="flex gap-3">
          <Thumb hue="accent" icon={<HeartIcon />} />
          <Thumb hue="partner" icon={<MapPinIcon />} />
          <Thumb hue="success" icon={<SparklesIcon />} />
          <Thumb hue="warning" icon={<CalendarIcon />} />
        </div>
        <Card className="flex flex-col gap-3 p-5">
          <SectionHeader title="Trip to Japan" action={<Chip tone="success">62%</Chip>} />
          <Progress value={0.62} label="Saved towards Trip to Japan" />
        </Card>
        <div className="flex gap-3">
          <IconBadge tone="accent">
            <ListChecksIcon />
          </IconBadge>
          <IconBadge tone="partner">
            <CalendarIcon />
          </IconBadge>
          <IconBadge tone="success">
            <MapPinIcon />
          </IconBadge>
          <IconBadge tone="warning" size="lg">
            <SparklesIcon />
          </IconBadge>
        </div>
        <EmptyState icon={<ListChecksIcon />} title="Nothing to do" body="Add a chore and it'll show up here." />
        <InlineError>Couldn&apos;t save that. Try again.</InlineError>
      </Section>

      <Section title="Layout">
        <Card className="p-0">
          <ScreenHeader
            eyebrow="Tuesday, 3 November"
            title="Good morning, Brandon"
            actions={<AvatarStack members={[BRANDON, ADELE]} />}
          />
        </Card>
        <Button variant="outline" size="md" onClick={() => p.onSheetOpenChange(true)}>
          Open the sheet
        </Button>
        <Label>Tab bar</Label>
        <div className="relative h-24 overflow-hidden rounded-card bg-surface-muted">
          <TabBar
            className="absolute inset-x-3 bottom-3"
            active="home"
            items={[
              { key: "home", label: "Home", href: "/design-system", icon: <HouseIcon /> },
              { key: "lists", label: "Lists", href: "/design-system", icon: <ListChecksIcon /> },
              { key: "calendar", label: "Calendar", href: "/design-system", icon: <CalendarIcon /> },
              { key: "places", label: "Places", href: "/design-system", icon: <MapPinIcon /> },
              { key: "wishlist", label: "Wishlist", href: "/design-system", icon: <HeartIcon /> },
            ]}
          />
        </div>
      </Section>

      <Sheet open={p.sheetOpen} onOpenChange={p.onSheetOpenChange} title="New chore" eyebrow="Sheet">
        <p className="text-callout text-ink-muted">Drag down or tap outside to close.</p>
        <Button block onClick={() => p.onSheetOpenChange(false)}>
          Done
        </Button>
      </Sheet>
    </main>
  );
}
