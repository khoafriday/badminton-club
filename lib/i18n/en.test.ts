import { describe, expect, it } from "vitest";
import { formatDayLabel, formatMonthLabel, weekdayShort } from "../dates";
import { translate } from ".";
import { EN } from "./en";
import { vietnameseStrings } from "./scan";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("English", () => {
  it("has an entry for every Vietnamese string in the app", () => {
    // A failure lists the new text: add it to lib/i18n/en.ts.
    const missing = [...vietnameseStrings(process.cwd())].filter(([text]) => !(text in EN));
    expect(missing.map(([text, file]) => `${file}: ${text}`)).toEqual([]);
  });

  it("keeps the same {placeholders} as the Vietnamese", () => {
    for (const [vi, en] of Object.entries(EN)) {
      const source = vi.split("@")[0];
      for (const form of en.split("|")) expect([vi, placeholders(form)]).toEqual([vi, placeholders(source)]);
    }
  });
});

describe("translate", () => {
  it("leaves Vietnamese as written and fills in values", () => {
    expect(translate("vi", "Còn nợ")).toBe("Còn nợ");
    expect(translate("vi", "{count} buổi", { count: 3 })).toBe("3 buổi");
  });

  it("looks up English and falls back to the Vietnamese text", () => {
    expect(translate("en", "Còn nợ")).toBe("Owed");
    expect(translate("en", "Chữ chưa dịch")).toBe("Chữ chưa dịch");
    expect(translate("en", "Đã nhận {amount} cho mã {code}", { amount: "50.000đ", code: "AB12" })).toBe(
      "Received 50.000đ for code AB12",
    );
  });

  it("picks singular or plural by count", () => {
    expect(translate("en", "{count} buổi", { count: 1 })).toBe("1 session");
    expect(translate("en", "{count} buổi", { count: 4 })).toBe("4 sessions");
  });

  it("uses an entry for the context when there is one", () => {
    expect(translate("en", "Bắt đầu", { context: "time" })).toBe("Start");
    expect(translate("en", "Bắt đầu")).toBe("Getting started");
    expect(translate("vi", "Bắt đầu", { context: "time" })).toBe("Bắt đầu");
  });
});

describe("dates in English", () => {
  it("labels days, weekdays and months", () => {
    expect(formatDayLabel("2026-10-27", "en")).toBe("Tue, 27/10");
    expect(weekdayShort(7, "en")).toBe("Sun");
    expect(weekdayShort(7)).toBe("CN");
    expect(weekdayShort(1)).toBe("T2");
    expect(formatMonthLabel("2026-10", "en")).toBe("October 2026");
    expect(formatMonthLabel("2026-10")).toBe("Tháng 10/2026");
  });
});
