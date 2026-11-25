// Pure helpers for the files bucket's layout: <together_id>/<file_id>/{original,thumb,preview}.bin.

const OBJECT = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\/(original|thumb|preview)\.bin$/;

/** the file id an object belongs to, or null for anything that isn't one of the app's objects */
export function fileIdOf(path: string): string | null {
  return OBJECT.exec(path)?.[2] ?? null;
}

/** how long an object may sit without a row before it's an orphan: longer than any upload can still be finishing */
export const ORPHAN_GRACE_MS = 60 * 60 * 1000;

/**
 * Objects with no files row (an upload aborted after some objects landed, a row swept while S3 was down) once
 * they're older than the grace period; and anything in the bucket that isn't one of the app's objects at all.
 */
export function orphanedObjects(
  objects: { path: string; modifiedAt: Date }[],
  knownIds: ReadonlySet<string>,
  now: Date,
  graceMs = ORPHAN_GRACE_MS,
): string[] {
  return objects
    .filter(({ path, modifiedAt }) => {
      if (now.getTime() - modifiedAt.getTime() < graceMs) return false;
      const id = fileIdOf(path);
      return id === null || !knownIds.has(id);
    })
    .map((o) => o.path);
}
