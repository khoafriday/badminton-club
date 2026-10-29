// Labels built from a date that read differently in English, shared by Tổng quan, Người còn nợ and Lịch sử đóng phí.
import { formatDayLabel, formatMonthLabel } from "../dates";
import type { Locale } from ".";

/** "2026-10" -> "Phí tháng 10/2026" or "Fee for October 2026" */
export function feeMonthLabel(month: string, locale: Locale): string {
  const label = formatMonthLabel(month, locale);
  return locale === "en" ? `Fee for ${label}` : `Phí ${label.toLowerCase()}`;
}

/** "2026-10-27" -> "Buổi Thứ 3, 27/10" or "Session Tue, 27/10" */
export function sessionDayLabel(date: string, locale: Locale): string {
  return `${locale === "en" ? "Session" : "Buổi"} ${formatDayLabel(date, locale)}`;
}
