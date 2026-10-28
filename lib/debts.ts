import "server-only";
import { db } from "./supabase";

export type DebtItem =
  | { kind: "session"; id: string; sessionId: string; date: string; amount: number }
  | { kind: "fee"; id: string; month: string; amount: number };

export type Debtor = { memberId: string; name: string; total: number; items: DebtItem[] };

/** "Thu phí vãng lai": a person with unpaid session lines, and those lines oldest first. */
export type GuestDebtor = { memberId: string; name: string; sessions: { id: string; date: string; amount: number }[] };

export function guestDebtors(debtors: Debtor[]): GuestDebtor[] {
  return debtors
    .map((d) => ({
      memberId: d.memberId,
      name: d.name,
      sessions: d.items.flatMap((i) => (i.kind === "session" ? [{ id: i.id, date: i.date, amount: i.amount }] : [])),
    }))
    .filter((d) => d.sessions.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

/** TT-5: who still owes money, for unpaid session lines and unpaid monthly slips. Cancelled sessions do not count. */
export async function loadDebtors(clubId: string): Promise<Debtor[]> {
  const [lines, slips] = await Promise.all([
    db()
      .from("attendance")
      .select(
        "id, session_id, member_id, amount_due, members!inner(full_name), sessions!inner(club_id, session_date, status)",
      )
      .eq("sessions.club_id", clubId)
      .eq("sessions.status", "active")
      .eq("is_present", true)
      .eq("charge_mode", "per_session")
      .eq("payment_status", "unpaid")
      .gt("amount_due", 0),
    db()
      .from("membership_fees")
      .select("id, member_id, period_month, amount_due, members!inner(full_name)")
      .eq("club_id", clubId)
      .eq("billing_mode", "monthly")
      .eq("payment_status", "unpaid")
      .gt("amount_due", 0),
  ]);
  if (lines.error) throw lines.error;
  if (slips.error) throw slips.error;

  const byMember = new Map<string, Debtor>();
  const add = (memberId: string, name: string, item: DebtItem) => {
    const d = byMember.get(memberId) ?? { memberId, name, total: 0, items: [] };
    d.items.push(item);
    d.total += item.amount;
    byMember.set(memberId, d);
  };

  type Line = {
    id: string;
    session_id: string;
    member_id: string;
    amount_due: number;
    members: { full_name: string };
    sessions: { session_date: string };
  };
  for (const l of lines.data as unknown as Line[]) {
    add(l.member_id, l.members.full_name, {
      kind: "session",
      id: l.id,
      sessionId: l.session_id,
      date: l.sessions.session_date,
      amount: Number(l.amount_due),
    });
  }
  type Slip = {
    id: string;
    member_id: string;
    period_month: string;
    amount_due: number;
    members: { full_name: string };
  };
  for (const s of slips.data as unknown as Slip[]) {
    add(s.member_id, s.members.full_name, {
      kind: "fee",
      id: s.id,
      month: s.period_month.slice(0, 7),
      amount: Number(s.amount_due),
    });
  }

  const debtors = [...byMember.values()];
  for (const d of debtors) {
    d.items.sort((a, b) => (a.kind === "fee" ? a.month : a.date).localeCompare(b.kind === "fee" ? b.month : b.date));
  }
  return debtors.sort((a, b) => b.total - a.total);
}
