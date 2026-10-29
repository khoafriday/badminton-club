// Calendar helpers on ISO date strings ("2026-10-27"). Pure, so they can be unit tested.
// Weekdays follow the schema: 1 = Monday ... 7 = Sunday.
import type { Locale } from "./i18n";

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** 1 = Monday ... 7 = Sunday */
export function weekdayOf(date: string): number {
  return toUtc(date).getUTCDay() || 7;
}

export function mondayOf(date: string): string {
  return addDays(date, 1 - weekdayOf(date));
}

/** "2026-10" -> "2026-11" */
export function addMonths(month: string, months: number): string {
  const d = toUtc(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return fromUtc(d).slice(0, 7);
}

/** Every date from `from` to `to` (both included) that falls on `weekday`. */
export function datesOnWeekday(weekday: number, from: string, to: string): string[] {
  const dates: string[] = [];
  let date = addDays(from, (weekday - weekdayOf(from) + 7) % 7);
  while (date <= to) {
    dates.push(date);
    date = addDays(date, 7);
  }
  return dates;
}

export const WEEKDAY_LABEL: Record<number, string> = {
  1: "Thứ 2",
  2: "Thứ 3",
  3: "Thứ 4",
  4: "Thứ 5",
  5: "Thứ 6",
  6: "Thứ 7",
  7: "Chủ nhật",
};

const WEEKDAY_LABEL_EN: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

/** 3 -> "Thứ 4" or "Wednesday" */
export function weekdayLabel(weekday: number, locale: Locale = "vi"): string {
  return (locale === "en" ? WEEKDAY_LABEL_EN : WEEKDAY_LABEL)[weekday];
}

/** 3 -> "T4" or "Wed", for narrow spots such as the weekday chips */
export function weekdayShort(weekday: number, locale: Locale = "vi"): string {
  if (locale === "en") return WEEKDAY_LABEL_EN[weekday].slice(0, 3);
  return weekday === 7 ? "CN" : `T${weekday + 1}`;
}

/** "2026-10-27" -> "Thứ 3, 27/10" or "Tue, 27/10" */
export function formatDayLabel(date: string, locale: Locale = "vi"): string {
  const day = locale === "en" ? weekdayShort(weekdayOf(date), "en") : WEEKDAY_LABEL[weekdayOf(date)];
  return `${day}, ${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/** "2026-10-27" -> "27/10" */
export function formatShortDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/** "2026-10-27" -> "27/10/2026" */
export function formatFullDate(date: string): string {
  return `${formatShortDate(date)}/${date.slice(0, 4)}`;
}

/** "19:00:00" -> "19:00" */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

const MONTH_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10" -> "Tháng 10/2026" or "October 2026" */
export function formatMonthLabel(month: string, locale: Locale = "vi"): string {
  if (locale === "en") return `${MONTH_EN[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
  return `Tháng ${Number(month.slice(5, 7))}/${month.slice(0, 4)}`;
}
