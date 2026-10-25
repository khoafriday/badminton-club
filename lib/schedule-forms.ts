// Validates the weekly schedule and session forms. Free of database code so it can be unit tested.
import { z } from "zod";

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Chọn giờ.");
const optionalText = z
  .string()
  .trim()
  .transform((v) => v || null);

function endAfterStart<T extends { start_time: string; end_time: string }>(value: T, ctx: z.RefinementCtx) {
  if (value.end_time.slice(0, 5) <= value.start_time.slice(0, 5)) {
    ctx.addIssue({ code: "custom", path: ["end_time"], message: "Giờ kết thúc phải sau giờ bắt đầu." });
  }
}

export const scheduleSchema = z
  .object({
    weekday: z.coerce.number().int().min(1, "Chọn thứ.").max(7, "Chọn thứ."),
    start_time: time,
    end_time: time,
    venue_name: optionalText,
  })
  .superRefine(endAfterStart);

export const sessionSchema = z
  .object({
    session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Chọn ngày."),
    start_time: time,
    end_time: time,
    venue_name: optionalText,
    note: optionalText,
  })
  .superRefine(endAfterStart);

export type ScheduleFormValues = { weekday: string; start_time: string; end_time: string; venue_name: string };
export type SessionFormValues = {
  session_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  note: string;
};

export function readForm<K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")])) as Record<K, string>;
}

export function firstError(error: z.ZodError): string {
  return error.issues[0].message;
}
