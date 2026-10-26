import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PriceSettings } from "./billing";
import { fakeDb, type Tables } from "./testing/fake-db";

vi.mock("server-only", () => ({}));
let tables: Tables;
vi.mock("./supabase", () => ({ db: () => fakeDb(tables) }));

const { ensureFeeSlips, listFeeSlips, listUnpaidFees } = await import("./fees");
const { loadDebtors } = await import("./debts");

const free: PriceSettings = { monthlyFeeMale: 0, monthlyFeeFemale: 0, guestPriceMale: 0, guestPriceFemale: 0 };
const priced: PriceSettings = { monthlyFeeMale: 300000, monthlyFeeFemale: 250000, guestPriceMale: 50000, guestPriceFemale: 40000 };
const CLUB = "club-1";
const TODAY = "2026-10-26";

beforeEach(() => {
  tables = {
    members: [
      { id: "an", club_id: CLUB, full_name: "An", gender: "male", member_type: "fixed", status: "active", fixed_since: "2026-10-01" },
      { id: "binh", club_id: CLUB, full_name: "Bình", gender: "female", member_type: "fixed", status: "active", fixed_since: "2026-09-01" },
    ],
    membership_fees: [],
    attendance: [],
  };
});

describe("monthly fee slips made before the fee was set", () => {
  it("shows 0đ while the fee in Cài đặt is 0, so nobody owes anything", async () => {
    await ensureFeeSlips(CLUB, TODAY, TODAY, free);
    const slips = await listFeeSlips(CLUB, TODAY);
    expect(slips.map((s) => [s.members.full_name, s.amount_due])).toEqual([
      ["An", 0],
      ["Bình", 0],
    ]);
    expect(await loadDebtors(CLUB)).toEqual([]);
  });

  it("takes the fee once it is set, and the members then show as owing", async () => {
    await ensureFeeSlips(CLUB, TODAY, TODAY, free);
    await ensureFeeSlips(CLUB, TODAY, TODAY, priced);

    const slips = await listFeeSlips(CLUB, TODAY);
    expect(slips.map((s) => [s.members.full_name, s.amount_due])).toEqual([
      ["An", 300000],
      ["Bình", 250000],
    ]);
    const debtors = await loadDebtors(CLUB);
    expect(debtors.map((d) => [d.name, d.total])).toEqual([
      ["An", 300000],
      ["Bình", 250000],
    ]);
    expect((await listUnpaidFees(CLUB)).map((f) => [f.memberName, f.month, f.amount])).toEqual([
      ["An", "2026-10", 300000],
      ["Bình", "2026-10", 250000],
    ]);
  });

  it("also prices 0đ slips of earlier months", async () => {
    await ensureFeeSlips(CLUB, "2026-09-01", TODAY, free);
    await ensureFeeSlips(CLUB, TODAY, TODAY, priced);
    const september = await listFeeSlips(CLUB, "2026-09-01");
    expect(september.map((s) => [s.members.full_name, s.amount_due])).toEqual([["Bình", 250000]]);
  });

  it("keeps slips that already have a price, and paid or Miễn slips, as they are (GIA-4)", async () => {
    await ensureFeeSlips(CLUB, TODAY, TODAY, priced);
    tables.membership_fees.push({
      id: "waived-0",
      club_id: CLUB,
      member_id: "an",
      period_month: "2026-08-01",
      billing_mode: "monthly",
      amount_due: 0,
      payment_status: "waived",
      waive_reason: "manual",
    });
    await ensureFeeSlips(CLUB, TODAY, TODAY, { ...priced, monthlyFeeMale: 350000 });

    const slips = await listFeeSlips(CLUB, TODAY);
    expect(slips.find((s) => s.member_id === "an")?.amount_due).toBe(300000);
    expect(tables.membership_fees.find((s) => s.id === "waived-0")?.amount_due).toBe(0);
  });
});
