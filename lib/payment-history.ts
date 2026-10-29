// Lịch sử đóng phí for a member: every amount they paid a club. Free of database code so it can be tested on its own.

export type PaidSlip = {
  id: string;
  clubId: string;
  month: string;
  billingMode: "monthly" | "per_session";
  amountDue: number;
  prepaid: number;
  status: "unpaid" | "paid" | "waived";
  paidAt: string | null;
  method: "cash" | "transfer" | null;
};

export type PaidVisit = {
  id: string;
  clubId: string;
  date: string;
  chargeMode: "monthly" | "per_session";
  amountDue: number;
  status: "unpaid" | "paid" | "exempt";
  paidAt: string | null;
  method: "cash" | "transfer" | null;
};

export type PaymentEntry = {
  key: string;
  clubId: string;
  kind: "fee" | "session";
  /** The month (YYYY-MM) of a fee, or the day of a session. */
  period: string;
  /** Day the money came in (YYYY-MM-DD, Vietnam time); null when only an earlier, undated part was paid. */
  paidOn: string | null;
  amount: number;
  method: "cash" | "transfer" | null;
};

/** "2026-10-28T17:30:00Z" -> "2026-10-29" in Vietnam. */
export function vietnamDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(timestamp));
}

/**
 * What was paid, newest first: monthly slips (with the part paid before a fee rise) and paid sessions.
 * The amounts add up to "Tổng đã đóng cho CLB" on Tổng quan.
 */
export function paymentEntries(slips: PaidSlip[], visits: PaidVisit[]): PaymentEntry[] {
  const fees = slips
    .filter((s) => s.billingMode === "monthly")
    .map((s) => {
      const paid = s.status === "paid";
      return {
        key: `fee:${s.id}`,
        clubId: s.clubId,
        kind: "fee" as const,
        period: s.month,
        paidOn: paid && s.paidAt ? vietnamDate(s.paidAt) : null,
        amount: s.prepaid + (paid ? s.amountDue : 0),
        method: paid ? s.method : null,
      };
    });
  const sessions = visits
    .filter((v) => v.chargeMode === "per_session" && v.status === "paid")
    .map((v) => ({
      key: `session:${v.id}`,
      clubId: v.clubId,
      kind: "session" as const,
      period: v.date,
      paidOn: v.paidAt ? vietnamDate(v.paidAt) : null,
      amount: v.amountDue,
      method: v.method,
    }));
  // Undated parts sort by the month they pay for.
  const sortDay = (e: PaymentEntry) => e.paidOn ?? (e.kind === "fee" ? `${e.period}-01` : e.period);
  return [...fees, ...sessions]
    .filter((e) => e.amount > 0)
    .sort((a, b) => sortDay(b).localeCompare(sortDay(a)) || b.period.localeCompare(a.period));
}
