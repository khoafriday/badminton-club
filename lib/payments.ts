import "server-only";
import { loadMemberHistory } from "./member-history";
import { debtItems, sameItems, type PaymentItem } from "./payment-items";
import { db } from "./supabase";
import { newPaymentCode } from "./vietqr";

export type BankAccount = { bin: string; accountNo: string; accountName: string };

/** The account the club is paid into, or null until the admin fills it in Cài đặt. */
export async function getBankAccount(clubId: string): Promise<BankAccount | null> {
  const { data, error } = await db()
    .from("club_settings")
    .select("bank_bin, bank_account_no, bank_account_name")
    .eq("club_id", clubId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.bank_account_no) return null;
  return { bin: data.bank_bin, accountNo: data.bank_account_no, accountName: data.bank_account_name ?? "" };
}

export type PaymentRequest = {
  id: string;
  code: string;
  amount: number;
  status: "pending" | "superseded" | "paid" | "needs_review";
  receivedAmount: number | null;
  createdAt: string;
};

const REQUEST_COLUMNS = "id, code, amount, status, received_amount, created_at";
type RequestRow = {
  id: string;
  code: string;
  amount: number;
  status: PaymentRequest["status"];
  received_amount: number | null;
  created_at: string;
};
const toRequest = (r: RequestRow): PaymentRequest => ({
  id: r.id,
  code: r.code,
  amount: Number(r.amount),
  status: r.status,
  receivedAmount: r.received_amount === null ? null : Number(r.received_amount),
  createdAt: r.created_at,
});

/** The member's newest QR in this club, whatever its status. */
export async function latestPaymentRequest(clubId: string, memberId: string): Promise<PaymentRequest | null> {
  const { data, error } = await db()
    .from("payment_requests")
    .select(REQUEST_COLUMNS)
    .eq("club_id", clubId)
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toRequest(data as RequestRow) : null;
}

async function requestItems(requestId: string): Promise<PaymentItem[]> {
  const { data, error } = await db()
    .from("payment_request_items")
    .select("membership_fee_id, attendance_id, amount")
    .eq("request_id", requestId);
  if (error) throw error;
  return data.map((i) =>
    i.membership_fee_id
      ? { kind: "fee" as const, id: i.membership_fee_id as string, amount: Number(i.amount) }
      : { kind: "session" as const, id: i.attendance_id as string, amount: Number(i.amount) },
  );
}

/** True while the newest QR still pays exactly what the member owes now. */
export async function isCurrent(request: PaymentRequest, memberId: string): Promise<boolean> {
  if (request.status !== "pending") return false;
  const [items, history] = await Promise.all([requestItems(request.id), loadMemberHistory(memberId)]);
  return sameItems(items, debtItems(history));
}

/**
 * "Đóng tiền nợ": a QR for everything the member owes now. The pending QR is kept while the debt is the same, so
 * tapping again shows the same code; when the debt changed it is superseded by a new one. Null: nothing is owed.
 */
export async function ensurePaymentRequest(clubId: string, memberId: string): Promise<PaymentRequest | null> {
  const items = debtItems(await loadMemberHistory(memberId));
  if (items.length === 0) return null;

  const { data: pending, error } = await db()
    .from("payment_requests")
    .select(REQUEST_COLUMNS)
    .eq("club_id", clubId)
    .eq("member_id", memberId)
    .eq("status", "pending");
  if (error) throw error;
  for (const row of pending as RequestRow[]) {
    if (sameItems(await requestItems(row.id), items)) return toRequest(row);
  }
  if (pending.length > 0) {
    const { error: supersedeError } = await db()
      .from("payment_requests")
      .update({ status: "superseded" })
      .in(
        "id",
        pending.map((r) => r.id),
      );
    if (supersedeError) throw supersedeError;
  }

  const amount = items.reduce((sum, i) => sum + i.amount, 0);
  // A clash on the unique code is very unlikely (32^6 codes); one retry covers it.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: created, error: insertError } = await db()
      .from("payment_requests")
      .insert({ club_id: clubId, member_id: memberId, code: newPaymentCode(), amount })
      .select(REQUEST_COLUMNS)
      .single();
    if (insertError?.code === "23505") continue;
    if (insertError) throw insertError;
    const request = toRequest(created as RequestRow);
    const { error: itemsError } = await db()
      .from("payment_request_items")
      .insert(
        items.map((i) => ({
          request_id: request.id,
          membership_fee_id: i.kind === "fee" ? i.id : null,
          attendance_id: i.kind === "session" ? i.id : null,
          amount: i.amount,
        })),
      );
    if (itemsError) throw itemsError;
    return request;
  }
  throw new Error("Could not make a unique payment code");
}

export type BankIssue = {
  id: string;
  amount: number;
  content: string;
  occurredAt: string;
  status: "overpaid" | "unmatched" | "needs_review";
  memberName: string | null;
  requestAmount: number | null;
};

/** Transfers the admin has to look at on Người còn nợ: money over, money short, or a QR whose debts changed. */
export async function listBankIssues(clubId: string): Promise<BankIssue[]> {
  const { data, error } = await db()
    .from("bank_transactions")
    .select("id, amount, content, occurred_at, status, payment_requests(amount, members(full_name))")
    .eq("club_id", clubId)
    .in("status", ["overpaid", "unmatched", "needs_review"])
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  type Row = {
    id: string;
    amount: number;
    content: string;
    occurred_at: string;
    status: BankIssue["status"];
    payment_requests: { amount: number; members: { full_name: string } | null } | null;
  };
  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    content: r.content,
    occurredAt: r.occurred_at,
    status: r.status,
    memberName: r.payment_requests?.members?.full_name ?? null,
    requestAmount: r.payment_requests ? Number(r.payment_requests.amount) : null,
  }));
}
