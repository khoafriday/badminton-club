import "server-only";
import type { FeeStatus, PaymentStatus } from "./billing";
import { paymentEntries, type PaidSlip, type PaidVisit } from "./payment-history";
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
  /** Paid earlier at a lower fee (amountDue is then the difference). */
  prepaid: number;
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
      .select("id, period_month, billing_mode, amount_due, prepaid_amount, payment_status")
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
    prepaid: Number(s.prepaid_amount ?? 0),
    status: s.payment_status,
  }));

  const owedSessions = visits
    .filter((v) => v.chargeMode === "per_session" && v.paymentStatus === "unpaid")
    .reduce((sum, v) => sum + v.amountDue, 0);
  const owedFees = slips
    .filter((s) => s.billingMode === "monthly" && s.status === "unpaid")
    .reduce((sum, s) => sum + s.amountDue, 0);

  // What the member has paid the club: monthly fees (with amounts paid before a fee rise) and paid sessions.
  const paidSessions = visits
    .filter((v) => v.chargeMode === "per_session" && v.paymentStatus === "paid")
    .reduce((sum, v) => sum + v.amountDue, 0);
  const paidFees = slips
    .filter((s) => s.billingMode === "monthly")
    .reduce((sum, s) => sum + s.prepaid + (s.status === "paid" ? s.amountDue : 0), 0);
  const paidMonths = slips.filter((s) => s.billingMode === "monthly" && s.status === "paid").length;

  return { visits, slips, owed: owedSessions + owedFees, paid: paidSessions + paidFees, paidMonths };
}

/** Lịch sử đóng phí: what one person paid, across the member rows they have (one per club). */
export async function loadPaymentHistory(memberIds: string[]) {
  if (memberIds.length === 0) return [];
  const [visitsResult, slipsResult] = await Promise.all([
    db()
      .from("attendance")
      .select("id, charge_mode, amount_due, payment_status, paid_at, payment_method, sessions!inner(session_date, status, club_id)")
      .in("member_id", memberIds)
      .eq("is_present", true)
      .eq("payment_status", "paid")
      .eq("sessions.status", "active"),
    db()
      .from("membership_fees")
      .select("id, club_id, period_month, billing_mode, amount_due, prepaid_amount, payment_status, paid_at, payment_method")
      .in("member_id", memberIds),
  ]);
  if (visitsResult.error) throw visitsResult.error;
  if (slipsResult.error) throw slipsResult.error;

  const visits: PaidVisit[] = (
    visitsResult.data as unknown as {
      id: string;
      charge_mode: "monthly" | "per_session";
      amount_due: number;
      payment_status: PaymentStatus;
      paid_at: string | null;
      payment_method: "cash" | "transfer" | null;
      sessions: { session_date: string; club_id: string };
    }[]
  ).map((v) => ({
    id: v.id,
    clubId: v.sessions.club_id,
    date: v.sessions.session_date,
    chargeMode: v.charge_mode,
    amountDue: Number(v.amount_due),
    status: v.payment_status,
    paidAt: v.paid_at,
    method: v.payment_method,
  }));
  const slips: PaidSlip[] = slipsResult.data.map((s) => ({
    id: s.id,
    clubId: s.club_id,
    month: (s.period_month as string).slice(0, 7),
    billingMode: s.billing_mode,
    amountDue: Number(s.amount_due),
    prepaid: Number(s.prepaid_amount ?? 0),
    status: s.payment_status,
    paidAt: s.paid_at,
    method: s.payment_method,
  }));
  return paymentEntries(slips, visits);
}
