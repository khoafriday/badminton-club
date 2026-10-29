import { describe, expect, it } from "vitest";
import { paymentEntries, vietnamDate, type PaidSlip, type PaidVisit } from "./payment-history";

const slip = (over: Partial<PaidSlip>): PaidSlip => ({
  id: "s1",
  clubId: "c1",
  month: "2026-10",
  billingMode: "monthly",
  amountDue: 200_000,
  prepaid: 0,
  status: "paid",
  paidAt: "2026-10-05T03:00:00Z",
  method: "cash",
  ...over,
});

const visit = (over: Partial<PaidVisit>): PaidVisit => ({
  id: "a1",
  clubId: "c1",
  date: "2026-09-20",
  chargeMode: "per_session",
  amountDue: 50_000,
  status: "paid",
  paidAt: "2026-09-20T13:00:00Z",
  method: "transfer",
  ...over,
});

describe("vietnamDate", () => {
  it("uses Vietnam time, not UTC", () => {
    expect(vietnamDate("2026-10-28T17:30:00Z")).toBe("2026-10-29");
  });
});

describe("paymentEntries", () => {
  it("lists paid months and paid sessions, newest first", () => {
    const entries = paymentEntries([slip({})], [visit({})]);
    expect(entries.map((e) => [e.kind, e.paidOn, e.amount])).toEqual([
      ["fee", "2026-10-05", 200_000],
      ["session", "2026-09-20", 50_000],
    ]);
  });

  it("leaves out unpaid, waived, zero and per-session slips, and sessions covered by the monthly fee", () => {
    const entries = paymentEntries(
      [
        slip({ id: "u", status: "unpaid", paidAt: null }),
        slip({ id: "w", status: "waived", paidAt: null }),
        slip({ id: "z", amountDue: 0 }),
        slip({ id: "p", billingMode: "per_session" }),
      ],
      [visit({ id: "m", chargeMode: "monthly" }), visit({ id: "x", status: "unpaid", paidAt: null })],
    );
    expect(entries).toEqual([]);
  });

  it("counts the part paid before a fee rise, also while the difference is still owed", () => {
    const [owing] = paymentEntries([slip({ status: "unpaid", prepaid: 180_000, amountDue: 20_000, paidAt: null })], []);
    expect(owing).toMatchObject({ amount: 180_000, paidOn: null, method: null });
    const [settled] = paymentEntries([slip({ prepaid: 180_000, amountDue: 20_000 })], []);
    expect(settled.amount).toBe(200_000);
  });

  it("sorts an undated part by the month it pays for", () => {
    const entries = paymentEntries(
      [
        slip({ id: "dec", month: "2026-12", status: "unpaid", prepaid: 180_000, paidAt: null }),
        slip({ id: "oct", month: "2026-10", paidAt: "2026-11-02T03:00:00Z" }),
      ],
      [],
    );
    expect(entries.map((e) => e.period)).toEqual(["2026-12", "2026-10"]);
  });
});
