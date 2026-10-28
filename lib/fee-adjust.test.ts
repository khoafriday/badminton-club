import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Tables } from "./testing/fake-db";

vi.mock("server-only", () => ({}));
let tables: Tables;
vi.mock("./supabase", () => ({ db: () => fakeDb(tables) }));

const { chargeFeeIncrease, listRefundable, refundMonths } = await import("./fee-adjust");
const CLUB = "club-1";

const slip = (id: string, month: string, status: string, amount: number, prepaid = 0) => ({
  id,
  club_id: CLUB,
  member_id: "an",
  period_month: `${month}-01`,
  billing_mode: "monthly",
  amount_due: amount,
  prepaid_amount: prepaid,
  payment_status: status,
});
const line = (slipId: string, amount: number) => ({
  id: `tx-${slipId}`,
  club_id: CLUB,
  type: "income",
  amount,
  source_type: "membership_fee",
  source_id: slipId,
});

beforeEach(() => {
  tables = {
    members: [{ id: "an", club_id: CLUB, full_name: "An", gender: "male" }],
    membership_fees: [slip("oct", "2026-10", "paid", 300000), slip("nov", "2026-11", "paid", 300000), slip("dec", "2026-12", "paid", 300000)],
    transactions: [line("oct", 300000), line("nov", 300000), line("dec", 300000)],
    transaction_categories: [{ id: "cat-refund", code: "fee_refund", club_id: null }],
  };
});

describe("refund when a member stops", () => {
  it("pays back the months after this one in one expense line and keeps the old payments", async () => {
    const months = await listRefundable(CLUB, "an", "2026-10");
    expect(months.map((m) => [m.month, m.amount])).toEqual([
      ["2026-11", 300000],
      ["2026-12", 300000],
    ]);
    await refundMonths("khoa", CLUB, "An", months, "2026-10-27");

    expect(tables.membership_fees.map((s) => s.id)).toEqual(["oct"]);
    const expense = tables.transactions.filter((t) => t.type === "expense");
    expect(expense).toMatchObject([
      { amount: 600000, category_id: "cat-refund", description: "Hoàn phí tháng 11/2026, 12/2026 cho An" },
    ]);
    // The income lines stay in the book, unlinked from the removed slips.
    expect(tables.transactions.filter((t) => t.type === "income").map((t) => t.source_type)).toEqual([
      "membership_fee",
      "manual",
      "manual",
    ]);
  });
});

describe("charge the difference when the fee goes up", () => {
  it("asks months after this one for the difference only", async () => {
    expect(await chargeFeeIncrease(CLUB, "2026-10", { male: 350000, female: 250000 })).toBe(2);
    const bySlip = Object.fromEntries(tables.membership_fees.map((s) => [s.id, [s.payment_status, s.amount_due, s.prepaid_amount]]));
    expect(bySlip).toEqual({
      oct: ["paid", 300000, 0],
      nov: ["unpaid", 50000, 300000],
      dec: ["unpaid", 50000, 300000],
    });
    // Paid again later, then the member stops: the whole 350.000 is paid back.
    tables.membership_fees.find((s) => s.id === "nov")!.payment_status = "paid";
    expect((await listRefundable(CLUB, "an", "2026-10")).map((m) => m.amount)).toEqual([350000, 300000]);
  });

  it("changes nothing when the fee goes down", async () => {
    expect(await chargeFeeIncrease(CLUB, "2026-10", { male: 250000, female: 250000 })).toBe(0);
    expect(tables.membership_fees.every((s) => s.payment_status === "paid")).toBe(true);
  });
});
