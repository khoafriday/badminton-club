// Validates the member form. Kept free of database code so it can be unit tested.
import { z } from "zod";

export const memberSchema = z
  .object({
    full_name: z.string().trim().min(1, "Nhập tên."),
    nickname: z
      .string()
      .trim()
      .transform((v) => v || null),
    gender: z.enum(["male", "female"], { error: "Chọn Nam hoặc Nữ." }),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+ .-]*$/, "Số điện thoại chỉ gồm chữ số.")
      .transform((v) => v || null),
    member_type: z.enum(["fixed", "guest"], { error: "Chọn Cố định hoặc Vãng lai." }),
    status: z.enum(["active", "inactive"]),
    fixed_since: z.string().trim(),
    note: z
      .string()
      .trim()
      .transform((v) => v || null),
  })
  .transform((m, ctx) => {
    // PHI-2: a fixed member needs the day they became fixed; a guest has none.
    if (m.member_type === "guest") return { ...m, fixed_since: null };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.fixed_since)) {
      ctx.addIssue({ code: "custom", path: ["fixed_since"], message: "Chọn ngày bắt đầu cố định." });
      return z.NEVER;
    }
    return m;
  });

export type MemberInput = z.output<typeof memberSchema>;

/** Raw form values, sent back to the form so React's reset does not wipe what was typed. */
export type MemberFormValues = {
  full_name: string;
  nickname: string;
  gender: string;
  phone: string;
  member_type: string;
  status: string;
  fixed_since: string;
  note: string;
  /** Adding someone already in the app (lib/member-candidates.ts) instead of typing a new member. */
  source_member_id?: string;
};

export function readMemberForm(formData: FormData): MemberFormValues {
  const get = (key: string) => String(formData.get(key) ?? "");
  return {
    full_name: get("full_name"),
    nickname: get("nickname"),
    gender: get("gender"),
    phone: get("phone"),
    member_type: get("member_type"),
    status: get("status") || "active",
    fixed_since: get("fixed_since"),
    note: get("note"),
    source_member_id: get("source_member_id"),
  };
}

/** Fixed from this day (PHI-2), for someone picked from the app's members: the only field the form still asks. */
export function parseFixedSince(value: string): { data: string } | { error: string } {
  const day = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? { data: day } : { error: "Chọn ngày bắt đầu cố định." };
}

export function parseMember(values: MemberFormValues): { data: MemberInput } | { error: string } {
  const parsed = memberSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return { data: parsed.data };
}

/**
 * A fixed member switched from Nghỉ back to Đang chơi is billed from today, like a new member:
 * returning mid-month is charged per session that month. fixed_since keeps their first day for history.
 */
export function rejoinedOnAfterEdit(
  before: { status: string; rejoined_on: string | null },
  next: Pick<MemberInput, "member_type" | "status">,
  today: string,
): string | null {
  if (next.member_type !== "fixed") return null;
  return before.status === "inactive" && next.status === "active" ? today : before.rejoined_on;
}
