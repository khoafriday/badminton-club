import { describe, expect, it } from "vitest";
import type { SlipRow, VisitRow } from "./member-history";
import { debtItems, sameItems } from "./payment-items";

const slip = (id: string, over: Partial<SlipRow> = {}): SlipRow => ({
  id,
  month: "2026-10",
  billingMode: "monthly",
  amountDue: 300000,
  prepaid: 0,
  status: "unpaid",
  ...over,
});
const visit = (id: string, over: Partial<VisitRow> = {}): VisitRow => ({
  attendanceId: id,
  sessionId: "s",
  date: "2026-10-20",
  chargeMode: "per_session",
  amountDue: 50000,
  paymentStatus: "unpaid",
  ...over,
});

describe("debtItems", () => {
  it("takes every unpaid month and session, the same lines as Đang nợ", () => {
    const items = debtItems({
      slips: [
        slip("sep", { month: "2026-09" }),
        slip("oct"),
        slip("paid", { status: "paid" }),
        slip("waived", { status: "waived" }),
        slip("per-session", { billingMode: "per_session" }),
        slip("zero", { amountDue: 0 }),
      ],
      visits: [visit("v1"), visit("v2", { paymentStatus: "paid" }), visit("v3", { chargeMode: "monthly" })],
    });
    expect(items).toEqual([
      { kind: "fee", id: "sep", amount: 300000 },
      { kind: "fee", id: "oct", amount: 300000 },
      { kind: "session", id: "v1", amount: 50000 },
    ]);
  });
});

describe("sameItems", () => {
  const a = [
    { kind: "fee" as const, id: "oct", amount: 300000 },
    { kind: "session" as const, id: "v1", amount: 50000 },
  ];
  it("ignores order", () => expect(sameItems(a, [...a].reverse())).toBe(true));
  it("sees a new line, a paid line or a changed amount", () => {
    expect(sameItems(a, [...a, { kind: "fee", id: "nov", amount: 300000 }])).toBe(false);
    expect(sameItems(a, a.slice(1))).toBe(false);
    expect(sameItems(a, [{ ...a[0], amount: 350000 }, a[1]])).toBe(false);
  });
});
