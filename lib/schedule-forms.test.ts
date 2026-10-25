import { describe, expect, it } from "vitest";
import { scheduleSchema, sessionSchema } from "./schedule-forms";

describe("scheduleSchema", () => {
  it("accepts a weekday with times and turns an empty court into null", () => {
    expect(scheduleSchema.parse({ weekday: "2", start_time: "19:00", end_time: "21:00", court_id: "" })).toEqual({
      weekday: 2,
      start_time: "19:00",
      end_time: "21:00",
      court_id: null,
    });
  });

  it("rejects an end time before the start time", () => {
    const result = scheduleSchema.safeParse({ weekday: "2", start_time: "21:00", end_time: "19:00", court_id: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Giờ kết thúc phải sau giờ bắt đầu.");
  });

  it("requires a weekday", () => {
    const result = scheduleSchema.safeParse({ weekday: "", start_time: "19:00", end_time: "21:00", court_id: "" });
    expect(result.error?.issues[0].message).toBe("Chọn thứ.");
  });
});

describe("sessionSchema", () => {
  it("compares times saved with seconds", () => {
    const result = sessionSchema.safeParse({
      session_date: "2026-10-27",
      start_time: "19:00:00",
      end_time: "21:00",
      court_id: "",
      note: "",
    });
    expect(result.success).toBe(true);
  });

  it("requires a date", () => {
    const result = sessionSchema.safeParse({
      session_date: "",
      start_time: "19:00",
      end_time: "21:00",
      court_id: "",
      note: "",
    });
    expect(result.error?.issues[0].message).toBe("Chọn ngày.");
  });
});
