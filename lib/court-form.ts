// Validates the court form (SAN-1). Free of database code so it can be unit tested.
import { z } from "zod";
import { parseVnd } from "./money";

const courtSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên sân."),
  address: z
    .string()
    .trim()
    .transform((v) => v || null),
  // Rent per hour, kept for reference only: nothing is charged or booked from it.
  price: z.string().transform((v, ctx) => {
    const amount = parseVnd(v);
    if (amount === null) {
      ctx.addIssue({ code: "custom", message: "Giá chỉ gồm chữ số, ví dụ 100.000." });
      return z.NEVER;
    }
    return amount;
  }),
});

export type CourtInput = z.output<typeof courtSchema>;

/** Raw form values, sent back to the form so React's reset does not wipe what was typed. */
export type CourtFormValues = { name: string; address: string; price: string };

export function readCourtForm(formData: FormData): CourtFormValues {
  const get = (key: string) => String(formData.get(key) ?? "");
  return { name: get("name"), address: get("address"), price: get("price") };
}

export function parseCourt(values: CourtFormValues): { data: CourtInput } | { error: string } {
  const parsed = courtSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return { data: parsed.data };
}
