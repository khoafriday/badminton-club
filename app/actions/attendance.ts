"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { billingStart, defaultSessionCharge } from "@/lib/billing";
import { getPriceSettings, requireClub } from "@/lib/club";
import { parseVnd } from "@/lib/money";
import { getSession } from "@/lib/schedule";
import { db } from "@/lib/supabase";

export type AttendanceResult = { error: string | null };
const FAILED = { error: "Không lưu được. Thử lại sau." };

/** The session, checked to belong to the user's club and not cancelled. */
async function openSession(sessionId: string) {
  const { userId, club } = await requireClub();
  const session = await getSession(club.id, sessionId);
  if (!session) return { ok: false, error: "Không tìm thấy buổi." } as const;
  if (session.status === "cancelled") return { ok: false, error: "Buổi đã hủy. Khôi phục buổi để điểm danh." } as const;
  return { ok: true, userId, club, session } as const;
}

async function attendanceInSession(sessionId: string, attendanceId: string) {
  const { data } = await db()
    .from("attendance")
    .select("id, payment_status, amount_due")
    .eq("id", attendanceId)
    .eq("session_id", sessionId)
    .maybeSingle();
  return data;
}

function refresh() {
  // The dashboard, debts list and member pages show the same lines.
  revalidatePath("/", "layout");
}

/** TT-1: mark present (creates the line with the default price) or absent (removes an unpaid line). */
export async function setPresence(sessionId: string, memberId: string, present: boolean): Promise<AttendanceResult> {
  const ctx = await openSession(sessionId);
  if (!ctx.ok) return { error: ctx.error };
  const { club, session } = ctx;

  if (!present) {
    const { data: line } = await db()
      .from("attendance")
      .select("id, payment_status")
      .eq("session_id", sessionId)
      .eq("member_id", memberId)
      .maybeSingle();
    if (!line) return { error: null };
    if (line.payment_status === "paid") return { error: "Người này đã nộp tiền. Bỏ Đã nộp trước khi bỏ điểm danh." };
    const { error } = await db().from("attendance").delete().eq("id", line.id);
    if (error) return FAILED;
    refresh();
    return { error: null };
  }

  const { data: member } = await db()
    .from("members")
    .select("id, gender, member_type, status, fixed_since, rejoined_on")
    .eq("id", memberId)
    .eq("club_id", club.id)
    .maybeSingle();
  if (!member) return { error: "Không tìm thấy thành viên." };

  const charge = defaultSessionCharge(
    {
      gender: member.gender,
      memberType: member.member_type,
      status: member.status,
      fixedSince: billingStart(member.fixed_since, member.rejoined_on),
    },
    session.session_date,
    await getPriceSettings(club.id),
  );
  const { error } = await db().from("attendance").upsert(
    {
      session_id: sessionId,
      member_id: memberId,
      member_type_snapshot: member.member_type,
      gender_snapshot: member.gender,
      is_present: true,
      charge_mode: charge.chargeMode,
      amount_due: charge.amountDue,
    },
    { onConflict: "session_id,member_id", ignoreDuplicates: true },
  );
  if (error) return FAILED;
  refresh();
  return { error: null };
}

/** TT-3: Đã nộp / Chưa nộp for one per-session line. The database function keeps the ledger in step. */
export async function setLinePaid(sessionId: string, attendanceId: string, paid: boolean): Promise<AttendanceResult> {
  const ctx = await openSession(sessionId);
  if (!ctx.ok) return { error: ctx.error };
  if (!(await attendanceInSession(sessionId, attendanceId))) return { error: "Không tìm thấy dòng điểm danh." };

  const { error } = await db().rpc("set_attendance_payment", {
    p_attendance_id: attendanceId,
    p_paid: paid,
    p_method: "cash",
    p_actor: ctx.userId,
  });
  if (error) return FAILED;
  refresh();
  return { error: null };
}

/** GIA-3: a custom price for one person in this session. */
export async function setLinePrice(sessionId: string, attendanceId: string, input: string): Promise<AttendanceResult> {
  const amount = parseVnd(input);
  if (amount === null) return { error: "Giá chỉ gồm chữ số, ví dụ 45.000." };
  const ctx = await openSession(sessionId);
  if (!ctx.ok) return { error: ctx.error };
  const line = await attendanceInSession(sessionId, attendanceId);
  if (!line) return { error: "Không tìm thấy dòng điểm danh." };

  const { error } = await db()
    .from("attendance")
    .update({ amount_due: amount, price_note: "Sửa giá", updated_at: new Date().toISOString() })
    .eq("id", attendanceId);
  if (error) return FAILED;
  // A paid line's ledger entry must follow the new price.
  if (line.payment_status === "paid") {
    const { error: rpcError } = await db().rpc("set_attendance_payment", {
      p_attendance_id: attendanceId,
      p_paid: amount > 0,
      p_method: "cash",
      p_actor: ctx.userId,
    });
    if (rpcError) return FAILED;
  }
  refresh();
  return { error: null };
}

const guestSchema = z.object({
  full_name: z.string().trim().min(1, "Nhập tên khách."),
  gender: z.enum(["male", "female"], { error: "Chọn Nam hoặc Nữ." }),
});

/** TT-2: add a new guest to the club and to this session in one step. Price follows gender; starts unpaid. */
export async function addNewGuest(sessionId: string, name: string, gender: string): Promise<AttendanceResult> {
  const parsed = guestSchema.safeParse({ full_name: name, gender });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await openSession(sessionId);
  if (!ctx.ok) return { error: ctx.error };

  const { data: member, error } = await db()
    .from("members")
    .insert({ ...parsed.data, club_id: ctx.club.id, member_type: "guest" })
    .select("id")
    .single();
  if (error) return FAILED;
  revalidatePath("/members");
  return setPresence(sessionId, member.id, true);
}
