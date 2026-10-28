import "server-only";
import { db } from "./supabase";

/**
 * Paid-ahead months change after the fact: a member who stops is paid back, and a higher fee asks for the difference.
 * The Phí tháng line already in the book stays as it was (money did come in); it is only unlinked from its slip,
 * so the slip can be paid again or removed without touching that line.
 */
async function detachPaymentLines(slipIds: string[]) {
  if (slipIds.length === 0) return;
  const { error } = await db()
    .from("transactions")
    .update({ source_type: "manual", source_id: null, updated_at: new Date().toISOString() })
    .eq("source_type", "membership_fee")
    .in("source_id", slipIds);
  if (error) throw error;
}

export type RefundMonth = { id: string; month: string; amount: number };

/** Months after `thisMonth` (YYYY-MM) the member already paid for, in part or in full. */
export async function listRefundable(clubId: string, memberId: string, thisMonth: string): Promise<RefundMonth[]> {
  const { data, error } = await db()
    .from("membership_fees")
    .select("id, period_month, amount_due, prepaid_amount, payment_status")
    .eq("club_id", clubId)
    .eq("member_id", memberId)
    .eq("billing_mode", "monthly")
    .gt("period_month", `${thisMonth}-01`);
  if (error) throw error;
  return data
    .map((s) => ({
      id: s.id as string,
      month: (s.period_month as string).slice(0, 7),
      amount: Number(s.prepaid_amount ?? 0) + (s.payment_status === "paid" ? Number(s.amount_due) : 0),
    }))
    .filter((s) => s.amount > 0)
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** Pays back the months in one Hoàn phí tháng expense line, and removes their slips. */
export async function refundMonths(
  userId: string,
  clubId: string,
  memberName: string,
  months: RefundMonth[],
  today: string,
) {
  if (months.length === 0) return;
  const { data: category, error } = await db()
    .from("transaction_categories")
    .select("id")
    .eq("code", "fee_refund")
    .is("club_id", null)
    .single();
  if (error) throw error;
  const ids = months.map((m) => m.id);
  await detachPaymentLines(ids);
  const { error: deleteError } = await db().from("membership_fees").delete().in("id", ids);
  if (deleteError) throw deleteError;
  const label = months.map((m) => `${Number(m.month.slice(5, 7))}/${m.month.slice(0, 4)}`).join(", ");
  const { error: txError } = await db()
    .from("transactions")
    .insert({
      club_id: clubId,
      type: "expense",
      category_id: category.id,
      amount: months.reduce((sum, m) => sum + m.amount, 0),
      occurred_on: today,
      description: `Hoàn phí tháng ${label} cho ${memberName}`,
      source_type: "manual",
      created_by: userId,
    });
  if (txError) throw txError;
}

/**
 * After the monthly fee goes up: months after `thisMonth` already paid at the old fee owe the difference.
 * Each such slip goes back to Chưa nộp for the difference only. A lower fee changes nothing.
 * Returns how many months now owe more.
 */
export async function chargeFeeIncrease(
  clubId: string,
  thisMonth: string,
  newFees: Record<"male" | "female", number>,
): Promise<number> {
  const { data, error } = await db()
    .from("membership_fees")
    .select("id, amount_due, prepaid_amount, payment_status, members!inner(gender)")
    .eq("club_id", clubId)
    .eq("billing_mode", "monthly")
    .gt("period_month", `${thisMonth}-01`);
  if (error) throw error;
  const slips = data as unknown as {
    id: string;
    amount_due: number;
    prepaid_amount: number | null;
    payment_status: "unpaid" | "paid" | "waived";
    members: { gender: "male" | "female" };
  }[];

  let changed = 0;
  for (const s of slips) {
    if (s.payment_status === "waived") continue;
    const fee = newFees[s.members.gender];
    const paid = s.payment_status === "paid";
    const prepaid = Number(s.prepaid_amount ?? 0) + (paid ? Number(s.amount_due) : 0);
    const owed = fee - prepaid;
    // Unpaid and already asking the right amount, or nothing more to ask.
    if (owed <= 0 || (!paid && Number(s.amount_due) === owed)) continue;
    if (paid) await detachPaymentLines([s.id]);
    const { error: updateError } = await db()
      .from("membership_fees")
      .update({
        amount_due: owed,
        prepaid_amount: prepaid,
        payment_status: "unpaid",
        paid_at: null,
        payment_method: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", s.id);
    if (updateError) throw updateError;
    changed++;
  }
  return changed;
}
