// Which dates a weekly schedule still has to create sessions for (LICH-2). Pure, so it can be unit tested.
import { addDays, datesOnWeekday } from "./dates";

/** Sessions are created this many days ahead, today included. */
export const HORIZON_DAYS = 28;

export type SchedulePlanInput = {
  weekday: number;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  generated_until: string | null;
};

export function planSessionDates(
  schedule: SchedulePlanInput,
  today: string,
): { dates: string[]; generatedUntil: string } | null {
  if (!schedule.is_active) return null;
  const horizon = addDays(today, HORIZON_DAYS - 1);
  let from = schedule.effective_from > today ? schedule.effective_from : today;
  if (schedule.generated_until && schedule.generated_until >= from) from = addDays(schedule.generated_until, 1);
  const to = schedule.effective_to && schedule.effective_to < horizon ? schedule.effective_to : horizon;
  if (from > to) return null;
  return { dates: datesOnWeekday(schedule.weekday, from, to), generatedUntil: to };
}
