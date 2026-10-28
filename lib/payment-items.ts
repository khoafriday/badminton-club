// What a "Đóng tiền nợ" QR pays for. Free of database code so it can be tested on its own.
import type { SlipRow, VisitRow } from "./member-history";

/** An unpaid monthly slip or an unpaid session line, at the amount owed. */
export type PaymentItem = { kind: "fee" | "session"; id: string; amount: number };

/** Everything the member owes, the same lines Tổng quan lists under Đang nợ. */
export function debtItems(history: { slips: SlipRow[]; visits: VisitRow[] }): PaymentItem[] {
  return [
    ...history.slips
      .filter((s) => s.billingMode === "monthly" && s.status === "unpaid" && s.amountDue > 0)
      .map((s) => ({ kind: "fee" as const, id: s.id, amount: s.amountDue })),
    ...history.visits
      .filter((v) => v.chargeMode === "per_session" && v.paymentStatus === "unpaid" && v.amountDue > 0)
      .map((v) => ({ kind: "session" as const, id: v.attendanceId, amount: v.amountDue })),
  ];
}

/** Same lines at the same amounts, in any order. */
export function sameItems(a: PaymentItem[], b: PaymentItem[]): boolean {
  const key = (i: PaymentItem) => `${i.kind}:${i.id}:${i.amount}`;
  const left = new Set(a.map(key));
  return a.length === b.length && left.size === b.length && b.every((i) => left.has(key(i)));
}
