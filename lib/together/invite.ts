// Invite codes, as people read and share them.

/** "K7Q29X" → "K7Q · 29X" */
export function spacedCode(code: string): string {
  return `${code.slice(0, 3)} · ${code.slice(3)}`;
}

/** the code's six characters, for the six boxes on the invite sheet */
export function codeBoxes(code: string): string[] {
  return Array.from({ length: 6 }, (_, i) => code.charAt(i));
}

/** the join link to share: /join/K7Q29X on this site */
export function joinUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/join/${code}`;
}

/** "Expires in 41 hours", "Expires in 20 minutes", "Expired" */
export function expiryLabel(expiresAt: string, now: number): string {
  const minutes = Math.floor((Date.parse(expiresAt) - now) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0) return "Expired";
  if (minutes < 60) return `Expires in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  return `Expires in ${hours} hour${hours === 1 ? "" : "s"}`;
}

export function isExpired(expiresAt: string, now: number): boolean {
  return Date.parse(expiresAt) <= now;
}

/** the message that goes with a shared invite */
export function inviteMessage(togetherName: string, url: string, code: string): string {
  return `Join ${togetherName} on Together: ${url} (or use the code ${code})`;
}
