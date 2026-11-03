import type { CatalogEntry, ItemSuggestion } from "@/lib/models";

/**
 * Shopping autocomplete. Ranks names that start with the query first, then ones with a word starting with it.
 * Within each, this Together's usual items come first (most-added first), then popular items, then the rest.
 * Items already on the list are left out.
 */
export function suggestItems(
  query: string,
  catalog: CatalogEntry[],
  onList: string[],
  limit = 4
): ItemSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const listed = new Set(onList.map((n) => n.toLowerCase()));

  const scored = catalog
    .filter((c) => !listed.has(c.name.toLowerCase()))
    .map((c) => {
      const name = c.name.toLowerCase();
      const prefix = name.startsWith(q);
      const word = !prefix && name.split(/\s+/).some((w) => w.startsWith(q));
      if (!prefix && !word) return null;
      const usual = c.timesAdded >= 3;
      return {
        entry: c,
        score: (prefix ? 0 : 1000) + (usual ? 0 : c.popular ? 100 : 200) - Math.min(c.timesAdded, 99),
        reason: usual ? ("usual" as const) : c.popular ? ("popular" as const) : null,
      };
    })
    .filter((s) => s !== null)
    .sort((a, b) => a.score - b.score || a.entry.name.localeCompare(b.entry.name));

  return scored.slice(0, limit).map((s) => ({ name: s.entry.name, reason: s.reason }));
}

/** where the query matches in a suggestion, to bold it: [before, match, after] */
export function splitMatch(name: string, query: string): [string, string, string] {
  const q = query.trim();
  const i = q ? name.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return [name, "", ""];
  return [name.slice(0, i), name.slice(i, i + q.length), name.slice(i + q.length)];
}
