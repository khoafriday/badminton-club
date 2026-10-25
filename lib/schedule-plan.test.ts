import { describe, expect, it } from "vitest";
import { planSessionDates, type SchedulePlanInput } from "./schedule-plan";

const tuesday: SchedulePlanInput = {
  weekday: 2,
  is_active: true,
  effective_from: "2026-10-01",
  effective_to: null,
  generated_until: null,
};

describe("planSessionDates", () => {
  it("fills the next 4 weeks from today on a new schedule", () => {
    expect(planSessionDates(tuesday, "2026-10-25")).toEqual({
      dates: ["2026-10-27", "2026-11-03", "2026-11-10", "2026-11-17"],
      generatedUntil: "2026-11-21",
    });
  });

  it("only adds the days after what was already created", () => {
    expect(planSessionDates({ ...tuesday, generated_until: "2026-11-21" }, "2026-10-28")).toEqual({
      dates: ["2026-11-24"],
      generatedUntil: "2026-11-24",
    });
  });

  it("does nothing when already filled up to the horizon", () => {
    expect(planSessionDates({ ...tuesday, generated_until: "2026-11-21" }, "2026-10-25")).toBeNull();
  });

  it("does nothing for a paused schedule", () => {
    expect(planSessionDates({ ...tuesday, is_active: false }, "2026-10-25")).toBeNull();
  });

  it("starts at effective_from and stops at effective_to", () => {
    expect(
      planSessionDates({ ...tuesday, effective_from: "2026-11-01", effective_to: "2026-11-05" }, "2026-10-25"),
    ).toEqual({ dates: ["2026-11-03"], generatedUntil: "2026-11-05" });
  });
});
