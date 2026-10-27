import "server-only";
import { billingStart, defaultSessionCharge, monthStart, type FeeStatus, type PriceSettings } from "./billing";
import { db } from "./supabase";

export type AttendanceView = {
  memberId: string;
  name: string;
  gender: "male" | "female";
  memberType: "fixed" | "guest";
  /** Null when the member is not marked present yet. */
  attendanceId: string | null;
  isPresent: boolean;
  chargeMode: "monthly" | "per_session";
  amountDue: number;
  paymentStatus: "unpaid" | "paid" | "exempt";
  priceNote: string | null;
  /** This month's fee slip status for members on the monthly fee; null when no slip exists. */
  monthlyFee: FeeStatus | null;
};

export type GuestOption = { id: string; name: string; gender: "male" | "female" };

type AttendanceRow = {
  id: string;
  member_id: string;
  member_type_snapshot: "fixed" | "guest";
  gender_snapshot: "male" | "female";
  is_present: boolean;
  charge_mode: "monthly" | "per_session";
  amount_due: number;
  price_note: string | null;
  payment_status: "unpaid" | "paid" | "exempt";
  members: { full_name: string };
};

type MemberRow = {
  id: string;
  full_name: string;
  gender: "male" | "female";
  member_type: "fixed" | "guest";
  status: "active" | "inactive";
  fixed_since: string | null;
  rejoined_on: string | null;
};

/** Everything the attendance screen shows for one session (TT-1 to TT-4). */
export async function loadAttendance(
  clubId: string,
  session: { id: string; session_date: string },
  settings: PriceSettings,
): Promise<{ fixed: AttendanceView[]; guests: AttendanceView[]; guestOptions: GuestOption[] }> {
  const [attendanceResult, membersResult, feesResult] = await Promise.all([
    db()
      .from("attendance")
      .select(
        "id, member_id, member_type_snapshot, gender_snapshot, is_present, charge_mode, amount_due, price_note, payment_status, members!inner(full_name)",
      )
      .eq("session_id", session.id),
    db()
      .from("members")
      .select("id, full_name, gender, member_type, status, fixed_since, rejoined_on")
      .eq("club_id", clubId)
      .eq("status", "active")
      .order("full_name"),
    db()
      .from("membership_fees")
      .select("member_id, billing_mode, payment_status")
      .eq("club_id", clubId)
      .eq("period_month", monthStart(session.session_date)),
  ]);
  if (attendanceResult.error) throw attendanceResult.error;
  if (membersResult.error) throw membersResult.error;
  if (feesResult.error) throw feesResult.error;

  const attendance = attendanceResult.data as unknown as AttendanceRow[];
  const members = membersResult.data as MemberRow[];
  const feeByMember = new Map(feesResult.data.map((f) => [f.member_id as string, f.payment_status as FeeStatus]));
  const byMember = new Map(attendance.map((a) => [a.member_id, a]));

  const fromRow = (a: AttendanceRow): AttendanceView => ({
    memberId: a.member_id,
    name: a.members.full_name,
    gender: a.gender_snapshot,
    memberType: a.member_type_snapshot,
    attendanceId: a.id,
    isPresent: a.is_present,
    chargeMode: a.charge_mode,
    amountDue: Number(a.amount_due),
    paymentStatus: a.payment_status,
    priceNote: a.price_note,
    monthlyFee: feeByMember.get(a.member_id) ?? null,
  });

  // Fixed list: every active fixed member who had started by that day, plus anyone already marked as fixed.
  const fixed: AttendanceView[] = [];
  for (const m of members) {
    const start = billingStart(m.fixed_since, m.rejoined_on);
    if (m.member_type !== "fixed" || !start || start > session.session_date) continue;
    const row = byMember.get(m.id);
    if (row) {
      fixed.push(fromRow(row));
      continue;
    }
    const charge = defaultSessionCharge(
      { gender: m.gender, memberType: m.member_type, status: m.status, fixedSince: start },
      session.session_date,
      settings,
    );
    fixed.push({
      memberId: m.id,
      name: m.full_name,
      gender: m.gender,
      memberType: "fixed",
      attendanceId: null,
      isPresent: false,
      chargeMode: charge.chargeMode,
      amountDue: charge.amountDue,
      paymentStatus: "unpaid",
      priceNote: null,
      monthlyFee: feeByMember.get(m.id) ?? null,
    });
  }
  const listed = new Set(fixed.map((r) => r.memberId));
  for (const a of attendance) {
    if (a.member_type_snapshot === "fixed" && !listed.has(a.member_id)) fixed.push(fromRow(a));
  }

  const guests = attendance
    .filter((a) => a.member_type_snapshot === "guest")
    .map(fromRow)
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));

  const guestOptions = members
    .filter((m) => !byMember.has(m.id) && !listed.has(m.id))
    .map((m) => ({ id: m.id, name: m.full_name, gender: m.gender }));

  return { fixed, guests, guestOptions };
}
