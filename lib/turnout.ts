/** How full a session is against its court's max_players: under, exactly full, or over. Null when the court has no max. */
export type Turnout = "under" | "full" | "over";

export function turnout(present: number, max: number | null): Turnout | null {
  if (max === null) return null;
  if (present < max) return "under";
  return present === max ? "full" : "over";
}
