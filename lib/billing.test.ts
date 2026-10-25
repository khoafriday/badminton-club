import { describe, expect, it } from "vitest";
import {
  applyFullMonthAbsence,
  buildFeeSlip,
  defaultSessionCharge,
  formatVnd,
  fundSummary,
  monthEnd,
  periodRange,
  sessionTotals,
  type MemberForBilling,
  type PriceSettings,
} from "./billing";

const prices: PriceSettings = {
  monthlyFeeMale: 300000,
  monthlyFeeFemale: 250000,
  guestPriceMale: 50000,
  guestPriceFemale: 40000,
};

const fixedMale: MemberForBilling = { memberType: "fixed", gender: "male", status: "active", fixedSince: "2026-01-01" };
const guestFemale: MemberForBilling = { memberType: "guest", gender: "female", status: "active", fixedSince: null };

describe("defaultSessionCharge", () => {
  it("charges guests the guest price for their gender", () => {
    expect(defaultSessionCharge(guestFemale, "2026-10-27", prices)).toEqual({ chargeMode: "per_session", amountDue: 40000 });
  });

  it("covers regular fixed members with the monthly fee", () => {
    expect(defaultSessionCharge(fixedMale, "2026-10-27", prices)).toEqual({ chargeMode: "monthly", amountDue: 0 });
  });

  it("charges mid-month joiners per session at the guest price during their first month", () => {
    const joiner = { ...fixedMale, fixedSince: "2026-10-15" };
    expect(defaultSessionCharge(joiner, "2026-10-27", prices)).toEqual({ chargeMode: "per_session", amountDue: 50000 });
    expect(defaultSessionCharge(joiner, "2026-11-03", prices)).toEqual({ chargeMode: "monthly", amountDue: 0 });
  });

  it("treats a member who joins on day 1 as monthly from that month", () => {
    const joiner = { ...fixedMale, fixedSince: "2026-10-01" };
    expect(defaultSessionCharge(joiner, "2026-10-27", prices).chargeMode).toBe("monthly");
  });
});

describe("buildFeeSlip", () => {
  it("uses the monthly fee for the member's gender", () => {
    expect(buildFeeSlip(fixedMale, "2026-10-01", prices)?.amountDue).toBe(300000);
    expect(buildFeeSlip({ ...fixedMale, gender: "female" }, "2026-10-01", prices)?.amountDue).toBe(250000);
  });

  it("creates a per-session slip with no monthly amount for mid-month joiners", () => {
    const slip = buildFeeSlip({ ...fixedMale, fixedSince: "2026-10-15" }, "2026-10-01", prices);
    expect(slip).toMatchObject({ billingMode: "per_session", amountDue: 0 });
  });

  it("skips guests, inactive members and members who are not fixed yet", () => {
    expect(buildFeeSlip(guestFemale, "2026-10-01", prices)).toBeNull();
    expect(buildFeeSlip({ ...fixedMale, status: "inactive" }, "2026-10-01", prices)).toBeNull();
    expect(buildFeeSlip({ ...fixedMale, fixedSince: "2026-11-02" }, "2026-10-01", prices)).toBeNull();
  });
});

describe("applyFullMonthAbsence", () => {
  const slip = buildFeeSlip(fixedMale, "2026-10-01", prices)!;

  it("waives an unpaid monthly slip when the member attended no session", () => {
    expect(applyFullMonthAbsence(slip, 0)).toMatchObject({ paymentStatus: "waived", waiveReason: "full_month_absence" });
  });

  it("keeps the slip when the member attended or already paid", () => {
    expect(applyFullMonthAbsence(slip, 1).paymentStatus).toBe("unpaid");
    expect(applyFullMonthAbsence({ ...slip, paymentStatus: "paid" }, 0).paymentStatus).toBe("paid");
  });
});

describe("sessionTotals", () => {
  it("counts only present people charged per session, and skips exempt ones", () => {
    const totals = sessionTotals([
      { isPresent: true, chargeMode: "per_session", amountDue: 50000, paymentStatus: "paid" },
      { isPresent: true, chargeMode: "per_session", amountDue: 40000, paymentStatus: "unpaid" },
      { isPresent: true, chargeMode: "per_session", amountDue: 45000, paymentStatus: "paid" },
      { isPresent: true, chargeMode: "per_session", amountDue: 40000, paymentStatus: "paid" },
      { isPresent: false, chargeMode: "per_session", amountDue: 50000, paymentStatus: "unpaid" },
      { isPresent: true, chargeMode: "monthly", amountDue: 0, paymentStatus: "unpaid" },
      { isPresent: true, chargeMode: "per_session", amountDue: 50000, paymentStatus: "exempt" },
    ]);
    expect(totals).toEqual({ due: 175000, paid: 135000, outstanding: 40000 });
  });
});

describe("fund", () => {
  const transactions = [
    { type: "income" as const, amount: 1000000, occurredOn: "2026-07-20" },
    { type: "income" as const, amount: 135000, occurredOn: "2026-10-27" },
    { type: "expense" as const, amount: 560000, occurredOn: "2026-10-25" },
    { type: "expense" as const, amount: 2400000, occurredOn: "2026-11-01" },
  ];

  it("computes balance for all time", () => {
    expect(fundSummary(transactions)).toEqual({ income: 1135000, expense: 2960000, balance: -1825000 });
  });

  it("filters by month and by quarter", () => {
    expect(fundSummary(transactions, periodRange("month", "2026-10-10"))).toEqual({ income: 135000, expense: 560000, balance: -425000 });
    expect(periodRange("quarter", "2026-11-05")).toEqual({ from: "2026-10-01", to: "2026-12-31" });
    expect(fundSummary(transactions, periodRange("quarter", "2026-08-01")).income).toBe(1000000);
  });

  it("knows month lengths, including leap years", () => {
    expect(monthEnd("2028-02-10")).toBe("2028-02-29");
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
  });
});

describe("formatVnd", () => {
  it("uses dots for thousands", () => {
    expect(formatVnd(50000)).toBe("50.000đ");
    expect(formatVnd(12480000)).toBe("12.480.000đ");
    expect(formatVnd(-560000)).toBe("-560.000đ");
    expect(formatVnd(0)).toBe("0đ");
  });
});
