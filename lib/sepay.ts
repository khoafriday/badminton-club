import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "./supabase";
import { findPaymentCodes } from "./vietqr";

/** One incoming transfer, whichever service reported it. */
export type BankTransfer = {
  providerTxId: string;
  accountNo: string;
  amount: number;
  content: string;
  /** ISO time with offset. */
  occurredAt: string;
};

/**
 * SePay's webhook body (docs.sepay.vn): id, gateway, transactionDate "YYYY-MM-DD HH:mm:ss" in Vietnam time,
 * accountNumber, content, transferType "in" | "out", transferAmount, ... Null for money going out or a body that
 * is not SePay's.
 */
export function parseSepayBody(body: unknown): BankTransfer | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.transferType !== "in") return null;
  const amount = Number(b.transferAmount);
  const when = typeof b.transactionDate === "string" ? b.transactionDate : "";
  if ((typeof b.id !== "number" && typeof b.id !== "string") || !Number.isSafeInteger(amount) || amount <= 0) return null;
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(when)) return null;
  return {
    providerTxId: String(b.id),
    accountNo: String(b.accountNumber ?? ""),
    amount,
    content: String(b.content ?? ""),
    occurredAt: `${when.replace(" ", "T")}+07:00`,
  };
}

/** SePay sends "Authorization: Apikey <key>", the key set in its webhook settings and in SEPAY_WEBHOOK_KEY. */
export function sepayKeyMatches(header: string | null): boolean {
  const key = process.env.SEPAY_WEBHOOK_KEY?.trim();
  if (!key || !header) return false;
  const given = header.replace(/^Apikey\s+/i, "").trim();
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(key).digest();
  return timingSafeEqual(a, b);
}

export type TransferOutcome = "ignored" | "duplicate" | "unmatched" | "matched" | "overpaid" | "needs_review";

/**
 * Stores a transfer that carries one of our codes and settles it against that QR. Transfers without a code are
 * other money on the admin's own account and are not stored. A transfer reported twice is settled once.
 */
export async function settleTransfer(transfer: BankTransfer, raw: unknown): Promise<TransferOutcome> {
  const codes = findPaymentCodes(transfer.content);
  if (codes.length === 0) return "ignored";

  const { data: requests, error } = await db().from("payment_requests").select("id, club_id, code").in("code", codes);
  if (error) throw error;
  // The account must be the one that club is paid into, so a code copied onto another account pays nothing.
  const { data: accounts, error: accountError } = await db()
    .from("club_settings")
    .select("club_id")
    .eq("bank_account_no", transfer.accountNo);
  if (accountError) throw accountError;
  const clubIds = new Set(accounts.map((a) => a.club_id as string));
  const request = requests.find((r) => clubIds.has(r.club_id as string));

  const { data: stored, error: insertError } = await db()
    .from("bank_transactions")
    .insert({
      provider: "sepay",
      provider_tx_id: transfer.providerTxId,
      club_id: request?.club_id ?? accounts[0]?.club_id ?? null,
      account_no: transfer.accountNo,
      amount: transfer.amount,
      content: transfer.content,
      occurred_at: transfer.occurredAt,
      raw,
    })
    .select("id")
    .single();
  if (insertError?.code === "23505") return "duplicate";
  if (insertError) throw insertError;
  if (!request) return "unmatched";

  const { data: outcome, error: rpcError } = await db().rpc("confirm_payment_request", {
    p_request_id: request.id,
    p_bank_tx_id: stored.id,
  });
  if (rpcError) {
    // Forget the transfer so SePay's retry settles it instead of being taken for a duplicate.
    await db().from("bank_transactions").delete().eq("id", stored.id);
    throw rpcError;
  }
  return outcome as TransferOutcome;
}
