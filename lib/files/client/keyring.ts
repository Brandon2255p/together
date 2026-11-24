import { importTogetherKey, type TogetherKey } from "@/lib/files/crypto";
import type { DataResult, FilesKey } from "@/lib/models";

// The Together's keys in this browser tab: imported once as non-extractable CryptoKeys and kept in memory only, never
// in localStorage. View-models call this; components never see a key.

export interface Keyring {
  togetherId: string;
  /** every version, for opening files sealed with an older one */
  keys: ReadonlyMap<number, TogetherKey>;
  /** what new uploads are sealed with */
  active: TogetherKey;
}

let cached: Promise<Keyring> | null = null;
let cachedFor: string | null = null;

/** the keys for this Together, fetched with `load` (the filesKeys action) the first time */
export function keyring(togetherId: string, load: () => Promise<DataResult<FilesKey[]>>): Promise<Keyring> {
  if (cached && cachedFor === togetherId) return cached;
  cachedFor = togetherId;
  cached = (async () => {
    const result = await load();
    if (!result.data?.length) throw new Error(result.error ?? "We couldn't open your files. Try again.");
    const keys = new Map<number, TogetherKey>();
    for (const k of result.data) keys.set(k.version, await importTogetherKey(k.key, k.version));
    const activeVersion = (result.data.find((k) => k.active) ?? result.data.at(-1)!).version;
    return { togetherId, keys, active: keys.get(activeVersion)! };
  })();
  // a failed load is tried again next time
  cached.catch(() => {
    if (cachedFor === togetherId) cached = null;
  });
  return cached;
}
