/**
 * "Good afternoon, Njoroge" — the greeting over an empty chat.
 *
 * Read in Nairobi time explicitly, rather than the server's own clock: a
 * dyno running in another region would otherwise say "Good evening" at
 * midday, and a greeting that differs between server render and client
 * hydration is a hydration error either way.
 */
export function greetingFor(name: string, now: Date = new Date()): string {
  const hour = Number(
    now.toLocaleString("en-US", { timeZone: "Africa/Nairobi", hour: "2-digit", hour12: false }),
  );
  const first = name.trim().split(/\s+/)[0] ?? "";
  const who = first ? `, ${first}` : "";

  if (hour < 5) return `Up with the birds${who}?`;
  if (hour < 12) return `Good morning${who}`;
  if (hour < 17) return `Good afternoon${who}`;
  if (hour < 22) return `Good evening${who}`;
  return `Still going${who}?`;
}
