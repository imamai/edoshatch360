/**
 * Saved edos.ai conversations, grouped the way a chat history actually reads:
 * today first, then yesterday, then the rest of the week, then everything
 * older.
 *
 * Grouped here rather than in the sidebar component, because "today" depends
 * on a clock: the browser's is wherever the farmer is, a Vercel server's is
 * UTC, and the two can disagree by hours. This is computed once, on the
 * server, so the label handed to the client is already settled and nothing
 * flickers on hydration.
 */

export interface HistoryItem {
  id: string;
  title: string;
}

export interface HistoryGroup {
  label: string;
  items: HistoryItem[];
}

const DAY = 86_400_000;

/** yyyy-mm-dd, read in Nairobi time regardless of the server's own zone. */
function nairobiDay(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
}

export function groupConversations(
  conversations: { id: string; title: string; updatedAt: string }[],
  now: Date = new Date(),
): HistoryGroup[] {
  const today = nairobiDay(now);
  const yesterday = nairobiDay(new Date(now.getTime() - DAY));
  const weekAgo = nairobiDay(new Date(now.getTime() - 7 * DAY));

  const groups: HistoryGroup[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const c of conversations) {
    const when = new Date(c.updatedAt);
    // An unreadable timestamp is still a conversation someone can open.
    const day = Number.isNaN(when.getTime()) ? "" : nairobiDay(when);
    const into = day === today ? 0 : day === yesterday ? 1 : day >= weekAgo && day !== "" ? 2 : 3;
    groups[into].items.push({ id: c.id, title: c.title });
  }

  return groups.filter((g) => g.items.length > 0);
}
