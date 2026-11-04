"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { AddressDraft } from "@/components/places/fields";
import type { EditableAddress, LinkedAddress } from "@/components/places/place-form-screen";
import { deletePlace, unlinkPlace, updatePlace } from "@/lib/actions/places";
import type { GooglePlaceDetails, Place, PlaceStatus } from "@/lib/models";
import { areaLabel } from "@/lib/places/address";

export interface EditPlaceViewData {
  place: Place;
  /** fetched fresh for the locked address card; null for places added by hand or when Google didn't answer */
  google: GooglePlaceDetails | null;
}

const join = (parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(", ");

/** 22: Edit place. A Google place's address is locked (Change place or Unlink); a by-hand place's is editable. */
export function useEditPlaceViewModel({ place, google }: EditPlaceViewData) {
  const router = useRouter();
  const [name, setName] = useState(place.name);
  const [kind, setKind] = useState(place.category);
  const [status, setStatus] = useState<PlaceStatus>(place.status);
  const [linked, setLinked] = useState(place.googlePlaceId !== null);
  const [address, setAddress] = useState<AddressDraft>({
    street: place.street,
    area: place.area,
    city: place.city,
    province: place.province,
    country: place.country,
  });
  const [pending, setPending] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailHref = `/places/${place.id}` as Route;

  /**
   * Optimistic: the fields open straight away, with Google's street filled in for you to keep or change (it's only
   * stored if you save it). Put back if the server says no.
   */
  async function unlink() {
    setError(null);
    setUnlinking(true);
    setLinked(false);
    setAddress((a) => ({ ...a, street: a.street || google?.address.street || "" }));
    const result = await unlinkPlace(place.id);
    setUnlinking(false);
    if (!result.success) {
      setLinked(true);
      setError(result.error ?? "We couldn't unlink it. Try again.");
    }
  }

  async function save() {
    if (!name.trim()) return setError("Give the place a name.");
    setPending(true);
    setError(null);
    const result = await updatePlace(place.id, { name, kind, status, ...address, street: linked ? "" : address.street });
    if (!result.data) {
      setPending(false);
      return setError(result.error ?? "We couldn't save your changes. Try again.");
    }
    router.replace(detailHref);
  }

  async function remove() {
    if (!confirmingDelete) return setConfirmingDelete(true);
    setDeleting(true);
    setError(null);
    const result = await deletePlace(place.id);
    if (!result.success) {
      setDeleting(false);
      setConfirmingDelete(false);
      return setError(result.error ?? "We couldn't delete it. Try again.");
    }
    router.replace(place.status === "want" ? "/places?tab=want" : "/places");
  }

  const linkedAddress: LinkedAddress = {
    linked: true,
    line1: join([google?.address.street ?? "", place.area]) || google?.formattedAddress || place.name,
    line2: areaLabel(place) || null,
    changeHref: `/places/new?replace=${place.id}` as Route,
    onUnlink: () => void unlink(),
    unlinking,
  };
  const editableAddress: EditableAddress = {
    linked: false,
    value: address,
    onChange: (patch) => setAddress((a) => ({ ...a, ...patch })),
  };

  return {
    title: "Edit place",
    backHref: detailHref,
    name,
    onNameChange: setName,
    kind,
    onKindChange: setKind,
    status,
    onStatusChange: setStatus,
    address: linked ? linkedAddress : editableAddress,
    submitLabel: "Save changes",
    onSubmit: () => void save(),
    pending,
    error,
    deletion: { confirming: confirmingDelete, onDelete: () => void remove(), pending: deleting },
  };
}
