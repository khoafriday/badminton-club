import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PriceSettings } from "@/lib/billing";
import { GUEST_FEE_OPTION, MEMBER_FEE_OPTION } from "@/lib/categories";
import type { Debtor } from "@/lib/debts";
import { fakeDb, type Tables } from "@/lib/testing/fake-db";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("REDIRECT");
  },
}));
let tables: Tables;
// set_fee_payment and set_attendance_payment, as in 0001_init.sql: the row becomes Đã nộp and writes one line.
const rpc = async (name: string, args: { p_fee_id?: string; p_attendance_id?: string; p_paid: boolean }) => {
  if (name === "set_attendance_payment") {
    const line = tables.attendance.find((a) => a.id === args.p_attendance_id)!;
    line.payment_status = "paid";
    tables.transactions.push({ source_type: "attendance", source_id: line.id, club_id: "club-1", amount: line.amount_due });
    return { error: null };
  }
  const slip = tables.membership_fees.find((s) => s.id === args.p_fee_id)!;
  slip.payment_status = args.p_paid ? "paid" : "unpaid";
  if (args.p_paid) {
    tables.transactions.push({ source_type: "membership_fee", source_id: slip.id, club_id: slip.club_id, amount: slip.amount_due });
  } else {
    tables.transactions = tables.transactions.filter((t) => t.source_id !== slip.id);
  }
  return { error: null };
};
vi.mock("@/lib/supabase", () => ({ db: () => ({ ...fakeDb(tables), rpc }) }));
const prices: PriceSettings = { monthlyFeeMale: 300000, monthlyFeeFemale: 250000, guestPriceMale: 0, guestPriceFemale: 0 };
vi.mock("@/lib/club", () => ({
  requireClub: async () => ({ userId: "khoa", club: { id: "club-1" } }),
  getPriceSettings: async () => prices,
  todayInVietnam: () => "2026-10-27",
}));

let debtors: Debtor[] = [];
vi.mock("@/lib/debts", async (original) => ({
  ...(await original<typeof import("@/lib/debts")>()),
  loadDebtors: async () => debtors,
}));

const { createTransaction, undoMemberFees } = await import("./fund");

function form(fields: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) fd.append(k, x);
  return fd;
}
const base = { type: "income", category_id: MEMBER_FEE_OPTION, amount: "", occurred_on: "2026-10-27", description: "" };
const save = (fields: Record<string, string | string[]>) =>
  createTransaction({ error: null, values: { ...base } }, form({ ...base, ...fields })).catch((e: Error) => e.message);

beforeEach(() => {
  tables = {
    members: [
      { id: "an", club_id: "club-1", full_name: "An", gender: "male", member_type: "fixed", status: "active", fixed_since: "2026-01-01", rejoined_on: null },
    ],
    membership_fees: [
      { id: "sep", club_id: "club-1", member_id: "an", period_month: "2026-09-01", billing_mode: "monthly", amount_due: 300000, payment_status: "unpaid" },
      { id: "nov", club_id: "club-1", member_id: "an", period_month: "2026-11-01", billing_mode: "monthly", amount_due: 300000, payment_status: "paid" },
    ],
    transactions: [],
  };
});

describe("Thu tiền sân, paying several months", () => {
  it("marks the ticked old month and N months from this month, skipping a paid month", async () => {
    expect(await save({ member_id: "an", fee_ids: "sep", months: "3" })).toBe("REDIRECT");
    const paid = tables.membership_fees
      .filter((s) => s.payment_status === "paid")
      .map((s) => s.period_month)
      .sort();
    expect(paid).toEqual(["2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01", "2027-01-01"]);
    // One ledger line per month paid now (Tháng 11 was paid before).
    expect(tables.transactions.map((t) => t.amount)).toEqual([300000, 300000, 300000, 300000]);
  });

  it("asks for a month when nothing is chosen", async () => {
    expect(await save({ member_id: "an", months: "0" })).toMatchObject({ error: "Chọn tháng còn nợ hoặc số tháng đóng." });
  });

  it("refuses a slip that is not an old debt of this member", async () => {
    expect(await save({ member_id: "an", fee_ids: "nov", months: "0" })).toMatchObject({
      error: "Có tháng đã thu hoặc đã Miễn. Tải lại trang rồi chọn lại.",
    });
  });

  it("undoes the whole payment: months back to Chưa nộp, months ahead removed", async () => {
    await save({ member_id: "an", fee_ids: "sep", months: "3" });
    const batch = tables.transactions[0].batch_id as string;
    expect(tables.transactions.every((t) => t.batch_id === batch)).toBe(true);

    await expect(undoMemberFees(batch)).rejects.toThrow("REDIRECT");
    expect(tables.transactions).toEqual([]);
    const left = tables.membership_fees.map((s) => [s.period_month, s.payment_status]).sort();
    // Tháng 9 is owed again, Tháng 10 (this month) stays as a debt, Tháng 11 was paid before.
    expect(left).toEqual([
      ["2026-09-01", "unpaid"],
      ["2026-10-01", "unpaid"],
      ["2026-11-01", "paid"],
    ]);
  });
});

describe("Thu phí vãng lai", () => {
  beforeEach(() => {
    tables.attendance = [
      { id: "a1", amount_due: 50000, payment_status: "unpaid" },
      { id: "a2", amount_due: 60000, payment_status: "unpaid" },
    ];
    debtors = [
      {
        memberId: "binh",
        name: "Bình",
        total: 110000,
        items: [
          { kind: "session", id: "a1", sessionId: "s1", date: "2026-10-20", amount: 50000 },
          { kind: "session", id: "a2", sessionId: "s2", date: "2026-10-22", amount: 60000 },
        ],
      },
    ];
  });
  const collect = (fields: Record<string, string | string[]>) =>
    save({ category_id: GUEST_FEE_OPTION, description: "Bình trả", ...fields });

  it("marks the ticked sessions Đã nộp and moves their lines to the form's date and note", async () => {
    expect(await collect({ member_id: "binh", attendance_ids: "a2" })).toBe("REDIRECT");
    expect(tables.attendance.map((a) => a.payment_status)).toEqual(["unpaid", "paid"]);
    expect(tables.transactions).toMatchObject([
      { source_id: "a2", amount: 60000, occurred_on: "2026-10-27", description: "Bình trả" },
    ]);
  });

  it("asks for a session when none is ticked", async () => {
    expect(await collect({ member_id: "binh" })).toMatchObject({ error: "Chọn buổi chưa nộp." });
  });

  it("refuses a session that is not this person's debt", async () => {
    debtors[0].items.pop();
    expect(await collect({ member_id: "binh", attendance_ids: "a2" })).toMatchObject({
      error: "Có buổi đã thu ở chỗ khác. Tải lại trang rồi chọn lại.",
    });
  });
});
