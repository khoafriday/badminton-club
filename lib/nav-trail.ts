// The screens visited in this tab, so ‹ goes to the screen before, not one level up.
// One entry per screen (path): coming back to a screen drops what was opened after it,
// so saving a form and landing on the list again does not leave the form as the way back.

export type TrailEntry = { path: string; url: string };

export function visit(trail: TrailEntry[], path: string, url: string): TrailEntry[] {
  const seen = trail.findIndex((e) => e.path === path);
  return [...(seen >= 0 ? trail.slice(0, seen) : trail), { path, url }];
}

/** Where ‹ leads: the screen before the current one, or `fallback` when the tab opened on this screen. */
export function backTarget(trail: TrailEntry[], fallback: string): string {
  return trail.at(-2)?.url ?? fallback;
}
