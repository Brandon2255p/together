"use client";

import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import type { PlacePreview, SuggestionRow } from "@/components/places/add-place-screen";
import {
  addGooglePlace,
  autocompletePlaces,
  changeGooglePlace,
  findPlaceFromMapsLink,
  previewGooglePlace,
} from "@/lib/actions/places";
import type { Coordinates, GooglePlaceDetails, PlaceStatus } from "@/lib/models";
import { kindFromGoogleType } from "@/lib/places/google-types";
import { highlightParts, hoursLabel, looksLikeLink, priceLabel } from "@/lib/places/preview";

export interface AddPlaceViewData {
  /** where autocomplete looks first: the middle of the city most of this Together's places are in */
  near: Coordinates | null;
  /** opened as /places/new?place=…: that place, already fetched */
  initial: GooglePlaceDetails | null;
  /** Change place (from Edit place): the place that gets the new Google place */
  replacing: { id: string; name: string } | null;
  status: PlaceStatus;
}

const DEBOUNCE_MS = 220;
const LINK_DEBOUNCE_MS = 500;

function toPreview(google: GooglePlaceDetails): PlacePreview {
  return {
    name: google.name,
    address: google.formattedAddress ?? "",
    photo: google.photo,
    rating: google.rating !== null ? google.rating.toFixed(1) : null,
    price: priceLabel(google.priceLevel),
    hours: hoursLabel(google),
  };
}

/**
 * Add a place (21a search, 21b preview), and Change place for Edit place. Owns the Google session token: one from the
 * first keystroke to the Details call that opens the preview, which ends the session (Google bills the typing as part
 * of that Details call).
 */
export function useAddPlaceViewModel(data: AddPlaceViewData) {
  const router = useRouter();
  const params = useSearchParams();
  const { replacing } = data;

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [searched, setSearched] = useState("");
  const [searching, setSearching] = useState(false);
  const [resolvingLink, setResolvingLink] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [picked, setPicked] = useState<GooglePlaceDetails | null>(data.initial);
  const [kind, setKind] = useState<string>(kindFromGoogleType(data.initial?.primaryType));
  const [status, setStatus] = useState<PlaceStatus>(data.status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = useRef<string | null>(null);
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** the preview was opened by pushing ?place=…, so Back can pop it */
  const pushed = useRef(false);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const placeParam = params.get("place");
  const showPreview = picked !== null && placeParam === picked.placeId;

  const baseQuery = replacing ? `?replace=${encodeURIComponent(replacing.id)}` : "";

  function search(text: string) {
    if (timer.current) clearTimeout(timer.current);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      latest.current++;
      setSuggestions([]);
      setSearched("");
      setSearching(false);
      return;
    }
    token.current ??= crypto.randomUUID();
    const sessionToken = token.current;
    setSearching(true);
    timer.current = setTimeout(() => void suggest(trimmed, sessionToken), DEBOUNCE_MS);
  }

  async function suggest(text: string, sessionToken: string) {
    const request = ++latest.current;
    const results = await autocompletePlaces(text, sessionToken, data.near);
    // a newer keystroke already asked again
    if (request !== latest.current) return;
    setSuggestions(results.map((s) => ({ placeId: s.placeId, parts: highlightParts(s.name, s.matches), secondary: s.secondary, road: s.road })));
    setSearched(text);
    setSearching(false);
  }

  async function open(placeId: string, sessionToken: string | null) {
    setPicking(placeId);
    setError(null);
    const result = await previewGooglePlace(placeId, sessionToken);
    setPicking(null);
    if (!result.data) return setError(result.error ?? "We couldn't open that place.");
    // the Details call ended the session: the next search starts a new one
    token.current = null;
    setPicked(result.data);
    setKind(kindFromGoogleType(result.data.primaryType));
    const search = new URLSearchParams(replacing ? { replace: replacing.id, place: placeId } : { place: placeId });
    window.history.pushState(null, "", `?${search.toString()}`);
    pushed.current = true;
  }

  async function resolveLink(text: string) {
    const request = ++latest.current;
    const result = await findPlaceFromMapsLink(text);
    // the box changed while the link was being followed
    if (request !== latest.current) return;
    setResolvingLink(false);
    if (!result.data) return setError(result.error ?? "We couldn't read that link.");
    const { placeId, name } = result.data;
    if (placeId) return open(placeId, null);
    if (replacing) return setError("Google Maps doesn't know that place. Try searching for it by name.");
    router.push(`/places/new/manual${name ? `?name=${encodeURIComponent(name)}` : ""}` as Route);
  }

  function onQueryChange(text: string) {
    setQuery(text);
    setError(null);
    if (looksLikeLink(text)) {
      // a paste arrives whole; typing a link by hand waits for a pause
      if (timer.current) clearTimeout(timer.current);
      latest.current++;
      setSearching(false);
      setSuggestions([]);
      setResolvingLink(true);
      timer.current = setTimeout(() => void resolveLink(text), LINK_DEBOUNCE_MS);
      return;
    }
    setResolvingLink(false);
    search(text);
  }

  function back() {
    setError(null);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      // opened straight on a place: show the search instead
      window.history.replaceState(null, "", `/places/new${baseQuery}`);
    }
  }

  async function submit() {
    if (!picked) return;
    setPending(true);
    setError(null);
    const result = replacing
      ? await changeGooglePlace(replacing.id, picked.placeId, null)
      : await addGooglePlace({ placeId: picked.placeId, kind, status });
    if (!result.data) {
      setPending(false);
      return setError(result.error ?? "We couldn't save that place. Try again.");
    }
    router.replace(`/places/${result.data.id}` as Route);
  }

  const typed = query.trim();
  const title = replacing ? "Change place" : "Add a place";

  return {
    showPreview,
    search: {
      title,
      closeHref: (replacing ? `/places/${replacing.id}/edit` : "/places") as Route,
      query,
      onQueryChange,
      resolvingLink,
      suggestions,
      searching,
      noResults: !searching && searched.length > 0 && searched === typed && suggestions.length === 0,
      picking,
      onPick: (placeId: string) => void open(placeId, token.current),
      manualHref: replacing
        ? null
        : ((typed && !looksLikeLink(typed) ? `/places/new/manual?name=${encodeURIComponent(typed)}` : "/places/new/manual") as Route),
      error: showPreview ? null : error,
    },
    preview: {
      title,
      onBack: back,
      place: picked ? toPreview(picked) : null,
      kind: replacing ? null : kind,
      onKindChange: setKind,
      status: replacing ? null : status,
      onStatusChange: setStatus,
      submitLabel: replacing ? `Use this for ${replacing.name}` : "Add place",
      onSubmit: () => void submit(),
      pending,
      error: showPreview ? error : null,
    },
  };
}
