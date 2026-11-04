/** What a chore reminder says: the chore itself when there's one, a count and the first few when there are more. */
export function choreReminderMessage(titles: string[]): { title: string; body: string; url: string } {
  const url = "/lists?tab=chores";
  if (titles.length === 1) return { title: "Due today", body: titles[0] ?? "", url };
  const shown = titles.slice(0, 3).join(", ");
  const more = titles.length - 3;
  return { title: `${titles.length} chores due today`, body: more > 0 ? `${shown} and ${more} more` : shown, url };
}
