"use client";

import type { PlaceStatus } from "@/lib/models";
import { PLACE_KINDS } from "@/lib/places/google-types";
import { chipVariants } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

// Form pieces shared by Add place (21b, 21c), Edit place (22), the filter sheet (20) and Log a visit (24).

/** the small uppercase label over a group of fields */
export function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-overline text-ink-subtle", className)}>{children}</p>;
}

/** a selectable chip: coral when chosen, grey otherwise */
export function OptionChip({ selected, className, ...props }: React.ComponentProps<"button"> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        chipVariants({ tone: selected ? "accent" : "neutral" }),
        "px-3 py-1.5 transition-colors duration-200",
        !selected && "hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}

/** Restaurant, Café, Bar, Hike, Bakery, Other; a kind from before these (e.g. "Japanese") shows as its own chip */
export function KindPicker({ value, onChange }: { value: string; onChange: (kind: string) => void }) {
  const kinds: string[] = [...PLACE_KINDS];
  if (value && !kinds.includes(value)) kinds.unshift(value);
  return (
    <div role="group" aria-label="Kind" className="flex flex-wrap gap-2">
      {kinds.map((kind) => (
        <OptionChip key={kind} selected={kind === value} onClick={() => onChange(kind)}>
          {kind}
        </OptionChip>
      ))}
    </div>
  );
}

export function StatusPicker({ value, onChange }: { value: PlaceStatus; onChange: (status: PlaceStatus) => void }) {
  return (
    <Segmented
      label="Status"
      value={value}
      onValueChange={onChange}
      options={[
        { value: "been", label: "Been here" },
        { value: "want", label: "Want to go" },
      ]}
    />
  );
}

/** a labelled single-line input */
export function InputField({
  label,
  icon,
  className,
  ...props
}: React.ComponentProps<"input"> & { label: string; icon?: React.ReactNode }) {
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      <FieldLabel>{label}</FieldLabel>
      <span
        className={cn(
          "flex h-14 items-center gap-3 rounded-field border border-line bg-surface px-[18px] transition-[border-color,box-shadow] duration-200",
          "focus-within:border-ink focus-within:shadow-[0_0_0_1px_var(--color-ink)]",
          "[&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:text-ink-muted",
        )}
      >
        {icon}
        <input
          className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-subtle"
          {...props}
        />
      </span>
    </label>
  );
}

export interface AddressDraft {
  street: string;
  area: string;
  city: string;
  province: string;
  country: string;
}

/** street, suburb, city, province and country, for places added by hand */
export function AddressFields({ value, onChange }: { value: AddressDraft; onChange: (patch: Partial<AddressDraft>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <InputField
        label="Street"
        placeholder="e.g. 30 Kloof Street"
        autoComplete="street-address"
        maxLength={80}
        value={value.street}
        onChange={(e) => onChange({ street: e.target.value })}
      />
      <InputField
        label="Suburb"
        placeholder="e.g. Gardens"
        maxLength={60}
        value={value.area}
        onChange={(e) => onChange({ area: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-3">
        <InputField
          label="City"
          placeholder="Cape Town"
          autoComplete="address-level2"
          maxLength={80}
          value={value.city}
          onChange={(e) => onChange({ city: e.target.value })}
        />
        <InputField
          label="Province / State"
          placeholder="Western Cape"
          autoComplete="address-level1"
          maxLength={80}
          value={value.province}
          onChange={(e) => onChange({ province: e.target.value })}
        />
      </div>
      <InputField
        label="Country"
        placeholder="South Africa"
        autoComplete="country-name"
        maxLength={80}
        value={value.country}
        onChange={(e) => onChange({ country: e.target.value })}
      />
    </div>
  );
}

/** the screen title row: a round back (or close) button and the title */
export function FormHeader({ title, back }: { title: string; back: React.ReactNode }) {
  return (
    <header className="flex items-center gap-3">
      {back}
      <h1 className="text-title">{title}</h1>
    </header>
  );
}
