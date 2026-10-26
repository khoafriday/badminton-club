import "server-only";
import {
  applyFullMonthAbsence,
  buildFeeSlip,
  monthEnd,
  monthStart,
  type FeeStatus,
  type MemberForBilling,
  type PriceSettings,
} from "./billing";
import { db } from "./supabase";

export type FeeSlipRow = {
  id: string;
  member_id: string;
  period_month: string;
  billing_mode: "monthly" | "per_session";
  amount_due: number;
  payment_status: FeeStatus;
  waive_reason: string | null;
  members: { full_name: string; gender: "male" | "female" };
};

type MemberRow = {
  id: string;
  gender: "male" | "female";
  member_type: "fixed" | "guest";
  status: "active" | "inactive";
  fixed_since: string | null;
};

function toBilling(m: MemberRow): MemberForBilling {
  return { gender: m.gender, memberType: m.member_type, status: m.status, fixedSince: m.fixed_since };
}

/**
 * PHI-1 to PHI-3: creates this month's fee slip for every active fixed member who has none yet.
 * Existing slips are never recalculated (GIA-4). Only runs for months that have started.
 */
export async function ensureFeeSlips(clubId: string, month: string, today: string, settings: PriceSettings) {
  const period = monthStart(month);
  if (period > monthStart(today)) return;

  const { data: members, error } = await db()
    .from("members")
    .select("id, gender, member_type, status, fixed_since")
    .eq("club_id", clubId)
    .eq("member_type", "fixed")
    .eq("status", "active")
    .lte("fixed_since", monthEnd(period));
  if (error) throw error;

  const rows = (members as MemberRow[]).flatMap((m) => {
    const slip = buildFeeSlip(toBilling(m), period, settings);
    return slip
      ? [
          {
            club_id: clubId,
            member_id: m.id,
            period_month: slip.periodMonth,
            billing_mode: slip.billingMode,
            amount_due: slip.amountDue,
          },
        ]
      : [];
  });
  if (rows.length === 0) return;
  const { error: insertError } = await db()
    .from("membership_fees")
    .upsert(rows, { onConflict: "member_id,period_month", ignoreDuplicates: true });
  if (insertError) throw insertError;
}

/** PHI-1: once a month is over, an unpaid monthly slip of someone who came to no session becomes Miễn. */
export async function waiveFullMonthAbsences(clubId: string, today: string) {
  const { data: slips, error } = await db()
    .from("membership_fees")
    .select("id, member_id, period_month, billing_mode, amount_due, payment_status, waive_reason")
    .eq("club_id", clubId)
    .eq("billing_mode", "monthly")
    .eq("payment_status", "unpaid")
    .lt("period_month", monthStart(today));
  if (error) throw error;

  // One count per slip, sent together so the wait does not grow with the number of slips.
  await Promise.all(
    slips.map(async (s) => {
      const { count, error: countError } = await db()
        .from("attendance")
        .select("id, sessions!inner(session_date, status)", { count: "exact", head: true })
        .eq("member_id", s.member_id)
        .eq("is_present", true)
        .eq("sessions.status", "active")
        .gte("sessions.session_date", s.period_month)
        .lte("sessions.session_date", monthEnd(s.period_month));
      if (countError) throw countError;

      const slip = applyFullMonthAbsence(
        {
          periodMonth: s.period_month,
          billingMode: s.billing_mode,
          amountDue: Number(s.amount_due),
          paymentStatus: s.payment_status,
          waiveReason: s.waive_reason,
        },
        count ?? 0,
      );
      if (slip.paymentStatus === "waived") {
        await db()
          .from("membership_fees")
          .update({ payment_status: "waived", waive_reason: slip.waiveReason, updated_at: new Date().toISOString() })
          .eq("id", s.id)
          .eq("payment_status", "unpaid");
      }
    }),
  );
}

export async function listFeeSlips(clubId: string, month: string): Promise<FeeSlipRow[]> {
  const { data, error } = await db()
    .from("membership_fees")
    .select(
      "id, member_id, period_month, billing_mode, amount_due, payment_status, waive_reason, members!inner(full_name, gender)",
    )
    .eq("club_id", clubId)
    .eq("period_month", monthStart(month));
  if (error) throw error;
  return (data as unknown as FeeSlipRow[])
    .map((s) => ({ ...s, amount_due: Number(s.amount_due) }))
    .sort((a, b) => a.members.full_name.localeCompare(b.members.full_name, "vi"));
}

export type UnpaidFee = { id: string; memberId: string; memberName: string; month: string; amount: number };

/** Unpaid monthly slips of the club, by member then month, for "Thu tiền sân" in the fund form. */
export async function listUnpaidFees(clubId: string): Promise<UnpaidFee[]> {
  const { data, error } = await db()
    .from("membership_fees")
    .select("id, member_id, period_month, amount_due, members!inner(full_name)")
    .eq("club_id", clubId)
    .eq("billing_mode", "monthly")
    .eq("payment_status", "unpaid")
    .gt("amount_due", 0);
  if (error) throw error;
  return (
    data as unknown as {
      id: string;
      member_id: string;
      period_month: string;
      amount_due: number;
      members: { full_name: string };
    }[]
  )
    .map((s) => ({
      id: s.id,
      memberId: s.member_id,
      memberName: s.members.full_name,
      month: s.period_month.slice(0, 7),
      amount: Number(s.amount_due),
    }))
    .sort((a, b) => a.memberName.localeCompare(b.memberName, "vi") || a.month.localeCompare(b.month));
}
