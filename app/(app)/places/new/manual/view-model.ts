"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { AddressDraft } from "@/components/places/fields";
import { addPlaceByHand } from "@/lib/actions/places";
import type { PlaceStatus } from "@/lib/models";

export interface ManualPlaceViewData {
  /** what was typed in the search, or the name a Maps link gave */
  name: string;
  status: PlaceStatus;
}

const EMPTY: AddressDraft = { street: "", area: "", city: "", province: "", country: "" };

/** 21c: a place Google doesn't have, added by hand */
export function useManualPlaceViewModel(data: ManualPlaceViewData) {
  const router = useRouter();
  const [name, setName] = useState(data.name);
  const [kind, setKind] = useState("Other");
  const [status, setStatus] = useState<PlaceStatus>(data.status);
  const [address, setAddress] = useState<AddressDraft>(EMPTY);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return setError("Give the place a name.");
    setPending(true);
    setError(null);
    const result = await addPlaceByHand({ name, kind, status, ...address });
    if (!result.data) {
      setPending(false);
      return setError(result.error ?? "We couldn't save that place. Try again.");
    }
    router.replace(`/places/${result.data.id}` as Route);
  }

  return {
    title: "Add it by hand",
    backHref: "/places/new" as Route,
    name,
    onNameChange: setName,
    kind,
    onKindChange: setKind,
    status,
    onStatusChange: setStatus,
    address: { linked: false as const, value: address, onChange: (patch: Partial<AddressDraft>) => setAddress((a) => ({ ...a, ...patch })) },
    submitLabel: "Add place",
    onSubmit: () => void submit(),
    pending,
    error,
    deletion: null,
  };
}
