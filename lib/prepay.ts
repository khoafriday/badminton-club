// "Thu tiền sân" paying ahead (QUY-1): which months N months of fee cover, counted from this month.
// Free of database code so the form can show the same months the server will mark.
import { buildFeeSlip, monthlyFee, type FeeStatus, type Gender, type PriceSettings } from "./billing";
import { addMonths } from "./dates";

/** A slip the member already has. month is YYYY-MM. */
export type SlipState = {
  id: string;
  month: string;
  mode: "monthly" | "per_session";
  status: FeeStatus;
  amount: number;
};

export type PrepayMember = {
  id: string;
  name: string;
  gender: Gender;
  /** Active fixed member: only they can pay ahead. Others are listed for their old debts. */
  canPayAhead: boolean;
  /** billingStart(): the day the monthly fee starts or starts again. */
  billingStart: string | null;
  slips: SlipState[];
};

/** slipId null: the month has no slip yet; it is made when the payment is saved. */
export type PrepayMonth = { month: string; amount: number; slipId: string | null };

/** Longest stretch looked at, so a member with every month already paid cannot loop forever. */
const MAX_MONTHS_AHEAD = 36;
export const MAX_PREPAY_COUNT = 12;

/**
 * The first `count` months from `fromMonth` on that the member still owes a monthly fee for.
 * Months already paid or Miễn, and a month charged per session (joined or came back mid-month), are skipped,
 * so the payment moves on to the month after. A new month is priced at today's fee for the member's gender.
 */
export function planPrepay(
  member: PrepayMember,
  fromMonth: string,
  count: number,
  settings: PriceSettings,
): PrepayMonth[] {
  if (!member.canPayAhead || count <= 0) return [];
  const byMonth = new Map(member.slips.map((s) => [s.month, s]));
  const plan: PrepayMonth[] = [];
  for (let i = 0; i < MAX_MONTHS_AHEAD && plan.length < count; i++) {
    const month = addMonths(fromMonth, i);
    const slip = byMonth.get(month);
    if (slip) {
      if (slip.mode === "monthly" && slip.status === "unpaid") plan.push({ month, amount: slip.amount, slipId: slip.id });
      continue;
    }
    const built = buildFeeSlip(
      { gender: member.gender, memberType: "fixed", status: "active", fixedSince: member.billingStart },
      `${month}-01`,
      settings,
    );
    if (built?.billingMode === "monthly") plan.push({ month, amount: monthlyFee(settings, member.gender), slipId: null });
  }
  return plan;
}

/**
 * Unpaid monthly slips ticked one by one in the form. For a member who pays ahead, only those before `fromMonth`:
 * this month on is covered by the number of months. A member who stopped sees every month they still owe.
 */
export function oldDebts(member: PrepayMember, fromMonth: string): SlipState[] {
  return member.slips
    .filter(
      (s) =>
        s.mode === "monthly" &&
        s.status === "unpaid" &&
        s.amount > 0 &&
        (!member.canPayAhead || s.month < fromMonth),
    )
    .sort((a, b) => a.month.localeCompare(b.month));
}
