import { describe, expect, it } from "vitest";
import { addDays, addMonths, datesOnWeekday, formatDayLabel, mondayOf, weekdayOf } from "./dates";

describe("dates", () => {
  it("counts Monday as 1 and Sunday as 7", () => {
    expect(weekdayOf("2026-10-26")).toBe(1);
    expect(weekdayOf("2026-11-01")).toBe(7);
  });

  it("adds days across a month end", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });

  it("finds the Monday of a week, Sunday included", () => {
    expect(mondayOf("2026-10-27")).toBe("2026-10-26");
    expect(mondayOf("2026-11-01")).toBe("2026-10-26");
  });

  it("adds months across a year end", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("lists every Tuesday in a range, ends included", () => {
    expect(datesOnWeekday(2, "2026-10-27", "2026-11-10")).toEqual(["2026-10-27", "2026-11-03", "2026-11-10"]);
    expect(datesOnWeekday(2, "2026-10-28", "2026-11-02")).toEqual([]);
  });

  it("labels a day in Vietnamese", () => {
    expect(formatDayLabel("2026-10-27")).toBe("Thứ 3, 27/10");
    expect(formatDayLabel("2026-11-01")).toBe("Chủ nhật, 01/11");
  });
});
