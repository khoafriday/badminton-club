import "server-only";
import type { FeeStatus, PaymentStatus } from "./billing";
import { db } from "./supabase";

export type VisitRow = {
  attendanceId: string;
  sessionId: string;
  date: string;
  chargeMode: "monthly" | "per_session";
  amountDue: number;
  paymentStatus: PaymentStatus;
};

export type SlipRow = {
  id: string;
  month: string;
  billingMode: "monthly" | "per_session";
  amountDue: number;
  status: FeeStatus;
};

/** Screen 8: recent sessions, fee slips and what the member still owes (TT-5 for one person). */
export async function loadMemberHistory(memberId: string) {
  const [visitsResult, slipsResult] = await Promise.all([
    db()
      .from("attendance")
      .select("id, session_id, charge_mode, amount_due, payment_status, sessions!inner(session_date, status)")
      .eq("member_id", memberId)
      .eq("is_present", true)
      .eq("sessions.status", "active"),
    db()
      .from("membership_fees")
      .select("id, period_month, billing_mode, amount_due, payment_status")
      .eq("member_id", memberId)
      .order("period_month", { ascending: false }),
  ]);
  if (visitsResult.error) throw visitsResult.error;
  if (slipsResult.error) throw slipsResult.error;

  const visits: VisitRow[] = (
    visitsResult.data as unknown as {
      id: string;
      session_id: string;
      charge_mode: "monthly" | "per_session";
      amount_due: number;
      payment_status: PaymentStatus;
      sessions: { session_date: string };
    }[]
  )
    .map((v) => ({
      attendanceId: v.id,
      sessionId: v.session_id,
      date: v.sessions.session_date,
      chargeMode: v.charge_mode,
      amountDue: Number(v.amount_due),
      paymentStatus: v.payment_status,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const slips: SlipRow[] = slipsResult.data.map((s) => ({
    id: s.id,
    month: (s.period_month as string).slice(0, 7),
    billingMode: s.billing_mode,
    amountDue: Number(s.amount_due),
    status: s.payment_status,
  }));

  const owedSessions = visits
    .filter((v) => v.chargeMode === "per_session" && v.paymentStatus === "unpaid")
    .reduce((sum, v) => sum + v.amountDue, 0);
  const owedFees = slips
    .filter((s) => s.billingMode === "monthly" && s.status === "unpaid")
    .reduce((sum, s) => sum + s.amountDue, 0);

  return { visits, slips, owed: owedSessions + owedFees };
}
