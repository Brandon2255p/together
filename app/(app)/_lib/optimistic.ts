/** ids of rows shown before the server has saved them */
export const TEMP = "temp-";

/**
 * A row as a view-model holds it: once an optimistic row is saved it gets its real id, and `clientKey` keeps the
 * temporary one so the list item's React key (and its animation) doesn't change.
 */
export type Optimistic<T> = T & { clientKey?: string };
