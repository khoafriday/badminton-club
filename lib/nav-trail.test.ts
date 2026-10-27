import { describe, expect, it } from "vitest";
import { backTarget, visit, type TrailEntry } from "./nav-trail";

function walk(...urls: string[]): TrailEntry[] {
  return urls.reduce<TrailEntry[]>((t, url) => visit(t, url.split("?")[0], url), []);
}

describe("nav trail", () => {
  it("goes back to the screen opened just before", () => {
    expect(backTarget(walk("/", "/debts", "/members/an"), "/members")).toBe("/debts");
    expect(backTarget(walk("/fund", "/fees"), "/members")).toBe("/fund");
  });

  it("uses the fallback when the tab opened on this screen", () => {
    expect(backTarget(walk("/fees"), "/members")).toBe("/members");
  });

  it("does not offer a saved form as the way back", () => {
    // Quỹ -> Ghi thu -> Lưu -> back on Quỹ: the form is gone, so ‹ leaves Quỹ.
    expect(walk("/", "/fund", "/fund/new", "/fund")).toEqual([
      { path: "/", url: "/" },
      { path: "/fund", url: "/fund" },
    ]);
  });

  it("counts a screen once, even after flipping its month or date", () => {
    const t = walk("/members", "/fees", "/fees?month=2026-09", "/fees?month=2026-08");
    expect(backTarget(t, "/")).toBe("/members");
  });

  it("keeps the last month or date of the screen it goes back to", () => {
    const t = walk("/schedule", "/schedule?date=2026-11-02", "/sessions/s1");
    expect(backTarget(t, "/schedule")).toBe("/schedule?date=2026-11-02");
  });
});
