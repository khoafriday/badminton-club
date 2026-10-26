// Money rules for the club: session charges, monthly fee slips and fund balance.
// Pure functions only, no database or UI, so every rule can be unit tested.
// Dates are ISO strings ("2026-10-27"); amounts are whole VND.

export type Gender = "male" | "female";
export type MemberType = "fixed" | "guest";
export type ChargeMode = "monthly" | "per_session";
export type PaymentStatus = "unpaid" | "paid" | "exempt";
export type FeeStatus = "unpaid" | "paid" | "waived";

export interface PriceSettings {
  monthlyFeeMale: number;
  monthlyFeeFemale: number;
  guestPriceMale: number;
  guestPriceFemale: number;
}

export interface MemberForBilling {
  memberType: MemberType;
  gender: Gender;
  status: "active" | "inactive";
  /** Day the member became fixed. Null for guests. */
  fixedSince: string | null;
}

export interface AttendanceLine {
  isPresent: boolean;
  chargeMode: ChargeMode;
  amountDue: number;
  paymentStatus: PaymentStatus;
}

export interface FeeSlip {
  periodMonth: string;
  billingMode: ChargeMode;
  amountDue: number;
  paymentStatus: FeeStatus;
  waiveReason: string | null;
}

export interface Transaction {
  type: "income" | "expense";
  amount: number;
  occurredOn: string;
}

export function guestPrice(settings: PriceSettings, gender: Gender): number {
  return gender === "male" ? settings.guestPriceMale : settings.guestPriceFemale;
}

export function monthlyFee(settings: PriceSettings, gender: Gender): number {
  return gender === "male" ? settings.monthlyFeeMale : settings.monthlyFeeFemale;
}

/** "2026-10-27" -> "2026-10-01" */
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Last day of the month that contains `date`, as an ISO string. */
export function monthEnd(date: string): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${date.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
}

/** PHI-2: a member who became fixed after day 1 pays per session for that month. */
export function joinedMidMonth(fixedSince: string, anyDateInMonth: string): boolean {
  return monthStart(fixedSince) === monthStart(anyDateInMonth) && fixedSince !== monthStart(fixedSince);
}

/**
 * Default charge for one person in one session (TT-2, PHI-2).
 * Guests and mid-month joiners pay the guest price by gender; other fixed members are covered by the monthly fee.
 */
export function defaultSessionCharge(
  member: MemberForBilling,
  sessionDate: string,
  settings: PriceSettings,
): { chargeMode: ChargeMode; amountDue: number } {
  const perSession =
    member.memberType === "guest" ||
    member.fixedSince === null ||
    member.fixedSince > sessionDate ||
    joinedMidMonth(member.fixedSince, sessionDate);

  return perSession
    ? { chargeMode: "per_session", amountDue: guestPrice(settings, member.gender) }
    : { chargeMode: "monthly", amountDue: 0 };
}

/**
 * Fee slip for one fixed member and one month, or null when no slip is due:
 * guests, inactive members (TV-3) and members who became fixed after that month.
 */
export function buildFeeSlip(
  member: MemberForBilling,
  periodMonth: string,
  settings: PriceSettings,
): FeeSlip | null {
  const month = monthStart(periodMonth);
  if (member.memberType !== "fixed" || member.status !== "active" || member.fixedSince === null) {
    return null;
  }
  if (member.fixedSince > monthEnd(month)) return null;

  if (joinedMidMonth(member.fixedSince, month)) {
    return { periodMonth: month, billingMode: "per_session", amountDue: 0, paymentStatus: "unpaid", waiveReason: null };
  }
  return {
    periodMonth: month,
    billingMode: "monthly",
    amountDue: monthlyFee(settings, member.gender),
    paymentStatus: "unpaid",
    waiveReason: null,
  };
}

/**
 * GIA-4 has one exception: an unpaid monthly slip made while the monthly fee was still 0
 * takes the fee once one is set. Returns the new amount, or null when the slip stays as it is.
 */
export function priceForUnpricedSlip(
  slip: Pick<FeeSlip, "billingMode" | "amountDue" | "paymentStatus">,
  gender: Gender,
  settings: PriceSettings,
): number | null {
  if (slip.billingMode !== "monthly" || slip.paymentStatus !== "unpaid" || slip.amountDue !== 0) return null;
  const fee = monthlyFee(settings, gender);
  return fee > 0 ? fee : null;
}

/** PHI-1: an unpaid monthly slip is waived when the member came to no session that month. */
export function applyFullMonthAbsence(slip: FeeSlip, sessionsAttended: number): FeeSlip {
  if (slip.billingMode !== "monthly" || slip.paymentStatus !== "unpaid" || sessionsAttended > 0) {
    return slip;
  }
  return { ...slip, paymentStatus: "waived", waiveReason: "full_month_absence" };
}

/** TT-4: money to collect for one session. Only people present and charged per session count. */
export function sessionTotals(lines: AttendanceLine[]): { due: number; paid: number; outstanding: number } {
  let due = 0;
  let paid = 0;
  for (const line of lines) {
    if (!line.isPresent || line.chargeMode !== "per_session" || line.paymentStatus === "exempt") continue;
    due += line.amountDue;
    if (line.paymentStatus === "paid") paid += line.amountDue;
  }
  return { due, paid, outstanding: due - paid };
}

export type FundPeriod = "month" | "quarter" | "all";

/** Date range for QUY-3. `null` bounds mean open-ended. */
export function periodRange(period: FundPeriod, anyDate: string): { from: string | null; to: string | null } {
  if (period === "all") return { from: null, to: null };
  if (period === "month") return { from: monthStart(anyDate), to: monthEnd(anyDate) };

  const year = anyDate.slice(0, 4);
  const firstMonth = Math.floor((Number(anyDate.slice(5, 7)) - 1) / 3) * 3 + 1;
  const from = `${year}-${String(firstMonth).padStart(2, "0")}-01`;
  const to = monthEnd(`${year}-${String(firstMonth + 2).padStart(2, "0")}-01`);
  return { from, to };
}

/** QUY-3: income, expense and balance (income minus expense) for a date range. */
export function fundSummary(
  transactions: Transaction[],
  range: { from: string | null; to: string | null } = { from: null, to: null },
): { income: number; expense: number; balance: number } {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (range.from && tx.occurredOn < range.from) continue;
    if (range.to && tx.occurredOn > range.to) continue;
    if (tx.type === "income") income += tx.amount;
    else expense += tx.amount;
  }
  return { income, expense, balance: income - expense };
}

/** 50000 -> "50.000đ" */
export function formatVnd(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const digits = String(Math.abs(Math.round(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${digits}đ`;
}
