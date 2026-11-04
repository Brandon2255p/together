"use client";

import Link from "next/link";
import type { Route } from "next";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeftIcon, MapPinIcon, NavigationIcon } from "lucide-react";
import type { PlaceStatus } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { iconButtonVariants } from "@/components/ui/icon-button";
import { InlineError } from "@/components/ui/layout";
import { AddressFields, FieldLabel, FormHeader, InputField, KindPicker, StatusPicker, type AddressDraft } from "./fields";

/** a Google place's address: shown fresh from Google, so it's locked; change the Google place or unlink it instead */
export interface LinkedAddress {
  linked: true;
  /** "21 Beach Road, Sea Point" */
  line1: string;
  /** "Cape Town · Western Cape · South Africa" */
  line2: string | null;
  changeHref: Route;
  onUnlink: () => void;
  unlinking: boolean;
}

export interface EditableAddress {
  linked: false;
  value: AddressDraft;
  onChange: (patch: Partial<AddressDraft>) => void;
}

export interface PlaceFormScreenProps {
  title: string;
  backHref: Route;
  name: string;
  onNameChange: (name: string) => void;
  kind: string;
  onKindChange: (kind: string) => void;
  status: PlaceStatus;
  onStatusChange: (status: PlaceStatus) => void;
  address: LinkedAddress | EditableAddress;
  submitLabel: string;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
  /** Edit place only: Delete, tapped twice */
  deletion: { confirming: boolean; onDelete: () => void; pending: boolean } | null;
}

/** 21c (Add a place by hand) and 22 (Edit place) */
export function PlaceFormScreen(props: PlaceFormScreenProps) {
  const { title, backHref, name, onNameChange, kind, onKindChange, status, onStatusChange, address, submitLabel, onSubmit, pending, error, deletion } =
    props;
  return (
    <form
      className="flex min-h-[calc(100dvh-3rem)] flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <FormHeader
        title={title}
        back={
          <Link href={backHref} aria-label="Back" className={iconButtonVariants({ variant: "surface" })}>
            <ChevronLeftIcon />
          </Link>
        }
      />

      <InputField
        label="Name"
        icon={<MapPinIcon aria-hidden />}
        placeholder="e.g. Mom's place"
        maxLength={120}
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        required
      />

      <div className="flex flex-col gap-2">
        <FieldLabel>Kind</FieldLabel>
        <KindPicker value={kind} onChange={onKindChange} />
      </div>

      <div className="flex flex-col gap-2">
        {address.linked ? <FieldLabel>Address</FieldLabel> : null}
        <AnimatePresence mode="wait" initial={false}>
          {address.linked ? (
            <motion.div key="linked" exit={{ opacity: 0, scale: 0.98 }} className="flex flex-col gap-2 rounded-row bg-surface px-4 py-3.5">
              <div className="flex items-start gap-3">
                <NavigationIcon className="mt-0.5 size-[18px] shrink-0 text-ink" aria-hidden />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-body-strong">{address.line1}</span>
                  {address.line2 ? <span className="text-caption text-ink-muted">{address.line2}</span> : null}
                </div>
              </div>
              <div className="flex items-center gap-3 pl-[30px]">
                <span className="flex-1 truncate text-caption text-ink-subtle">From Google Maps</span>
                <Link href={address.changeHref} className="shrink-0 text-callout text-accent-ink">
                  Change place
                </Link>
                <button type="button" onClick={address.onUnlink} disabled={address.unlinking} className="shrink-0 text-callout text-ink-muted hover:text-ink disabled:opacity-50">
                  Unlink
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="fields" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <AddressFields value={address.value} onChange={address.onChange} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel>Status</FieldLabel>
        <StatusPicker value={status} onChange={onStatusChange} />
      </div>

      <InlineError>{error}</InlineError>

      <div className="mt-auto flex flex-col gap-2 pt-4 pb-2">
        <Button type="submit" block pending={pending}>
          {submitLabel}
        </Button>
        {deletion ? (
          <button
            type="button"
            onClick={deletion.onDelete}
            disabled={deletion.pending}
            className="py-3 text-callout text-warning-ink hover:text-accent-ink disabled:opacity-50"
          >
            {deletion.confirming ? "Tap again to delete it for everyone" : "Delete place"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
