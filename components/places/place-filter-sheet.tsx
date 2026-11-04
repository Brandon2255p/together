"use client";

import { CheckIcon } from "lucide-react";
import type { PlaceSort } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { FieldLabel, OptionChip } from "./fields";

export type AreaLevel = "country" | "province" | "city";

export interface AreaOption {
  value: string;
  count: number;
}

export interface PlaceFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: Record<AreaLevel, AreaOption[]>;
  selected: Record<AreaLevel, string>;
  /** picking the chosen one again clears it */
  onSelect: (level: AreaLevel, value: string) => void;
  sort: PlaceSort;
  sorts: { value: PlaceSort; label: string; hint?: string }[];
  onSortChange: (sort: PlaceSort) => void;
  onClear: () => void;
  onApply: () => void;
  /** how many places on this tab the choices leave */
  matching: number;
}

const LEVELS: { level: AreaLevel; label: string }[] = [
  { level: "country", label: "Country" },
  { level: "province", label: "Province / State" },
  { level: "city", label: "City" },
];

export function PlaceFilterSheet(props: PlaceFilterSheetProps) {
  const { open, onOpenChange, options, selected, onSelect, sort, sorts, onSortChange, onClear, onApply, matching } = props;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Filter & sort" className="gap-4">
      <button type="button" onClick={onClear} className="absolute top-9 right-5 text-callout text-accent-ink">
        Clear
      </button>

      {LEVELS.map(({ level, label }) =>
        options[level].length ? (
          <div key={level} className="flex flex-col gap-2">
            <FieldLabel>{label}</FieldLabel>
            <div role="group" aria-label={label} className="flex flex-wrap gap-2">
              {options[level].map((o) => (
                <OptionChip key={o.value} selected={selected[level] === o.value} onClick={() => onSelect(level, o.value)}>
                  {o.value} · {o.count}
                </OptionChip>
              ))}
            </div>
          </div>
        ) : null,
      )}

      <div className="flex flex-col gap-2">
        <FieldLabel>Sort by</FieldLabel>
        <div role="radiogroup" aria-label="Sort by" className="flex flex-col rounded-row bg-surface-muted p-1">
          {sorts.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={s.value === sort}
              onClick={() => onSortChange(s.value)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-left text-callout transition-colors",
                s.value === sort ? "text-ink" : "text-ink-muted hover:text-ink",
              )}
            >
              <span className="flex flex-col">
                {s.label}
                {s.hint && s.value === sort ? <span className="text-caption text-ink-subtle">{s.hint}</span> : null}
              </span>
              {s.value === sort ? <CheckIcon className="size-[18px] text-accent" aria-hidden /> : null}
            </button>
          ))}
        </div>
      </div>

      <Button block onClick={onApply}>
        {matching === 1 ? "Show 1 place" : `Show ${matching} places`}
      </Button>
    </Sheet>
  );
}
