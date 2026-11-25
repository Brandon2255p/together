// How many Togethers one person can be in at once. The database enforces it (triggers/together_members_limit.sql);
// the app says so before anyone tries.
export const MAX_TOGETHERS = 2;

export const TOO_MANY_TOGETHERS = `You can be in ${MAX_TOGETHERS} Togethers at most. Leave one to start or join another.`;

/** whether someone in `count` Togethers may start or join another */
export const canAddTogether = (count: number) => count < MAX_TOGETHERS;
