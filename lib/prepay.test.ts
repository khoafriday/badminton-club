import { describe, expect, it } from "vitest";
import type { PriceSettings } from "./billing";
import { oldDebts, planPrepay, type PrepayMember } from "./prepay";

const prices: PriceSettings = { monthlyFeeMale: 300000, monthlyFeeFemale: 250000, guestPriceMale: 50000, guestPriceFemale: 40000 };
const an: PrepayMember = { id: "an", name: "An", gender: "male", canPayAhead: true, billingStart: "2026-01-01", slips: [] };

describe("planPrepay", () => {
  it("covers N months from this month at today's fee", () => {
    expect(planPrepay(an, "2026-10", 3, prices)).toEqual([
      { month: "2026-10", amount: 300000, slipId: null },
      { month: "2026-11", amount: 300000, slipId: null },
      { month: "2026-12", amount: 300000, slipId: null },
    ]);
  });

  it("uses an existing unpaid slip and skips paid or Miễn months", () => {
    const member: PrepayMember = {
      ...an,
      gender: "female",
      slips: [
        { id: "oct", month: "2026-10", mode: "monthly", status: "unpaid", amount: 200000 },
        { id: "nov", month: "2026-11", mode: "monthly", status: "paid", amount: 250000 },
        { id: "dec", month: "2026-12", mode: "monthly", status: "waived", amount: 250000 },
      ],
    };
    expect(planPrepay(member, "2026-10", 2, prices)).toEqual([
      { month: "2026-10", amount: 200000, slipId: "oct" },
      { month: "2027-01", amount: 250000, slipId: null },
    ]);
  });

  it("skips a month charged per session and months before the fee starts", () => {
    expect(planPrepay({ ...an, billingStart: "2026-11-15" }, "2026-10", 2, prices).map((m) => m.month)).toEqual([
      "2026-12",
      "2027-01",
    ]);
  });

  it("gives nothing to a member who cannot pay ahead", () => {
    expect(planPrepay({ ...an, canPayAhead: false }, "2026-10", 2, prices)).toEqual([]);
  });
});

describe("oldDebts", () => {
  it("lists unpaid monthly slips before this month only", () => {
    const member: PrepayMember = {
      ...an,
      slips: [
        { id: "oct", month: "2026-10", mode: "monthly", status: "unpaid", amount: 300000 },
        { id: "sep", month: "2026-09", mode: "monthly", status: "unpaid", amount: 300000 },
        { id: "aug", month: "2026-08", mode: "monthly", status: "paid", amount: 300000 },
        { id: "jul", month: "2026-07", mode: "per_session", status: "unpaid", amount: 0 },
      ],
    };
    expect(oldDebts(member, "2026-10").map((s) => s.id)).toEqual(["sep"]);
    // A member who stopped cannot pay ahead, so this month's debt is ticked like the others.
    expect(oldDebts({ ...member, canPayAhead: false }, "2026-10").map((s) => s.id)).toEqual(["sep", "oct"]);
  });
});
