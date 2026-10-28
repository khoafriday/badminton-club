"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loadViewer, requireClub } from "@/lib/club";
import { ensurePaymentRequest, getBankAccount } from "@/lib/payments";
import { db } from "@/lib/supabase";

/** "Đóng tiền nợ" on a member's Tổng quan: makes or reuses the QR for what they owe, then opens it. */
export async function openPaymentQr() {
  const viewer = await loadViewer();
  if (viewer.kind !== "member") redirect("/");
  if (await getBankAccount(viewer.club.id)) {
    await ensurePaymentRequest(viewer.club.id, viewer.memberId);
  }
  redirect("/pay");
}

const bankSchema = z.object({
  bank_account_no: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6,19}$/, "Số tài khoản chỉ gồm 6 đến 19 chữ số.")),
  // VietQR shows the name without accents, in capitals, as the bank has it.
  bank_account_name: z
    .string()
    .trim()
    .transform((v) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "D").toUpperCase())
    .pipe(z.string().min(1, "Nhập tên chủ tài khoản.")),
});

type BankValues = { bank_account_no: string; bank_account_name: string };
export type BankState = { error: string | null; saved: boolean; values: BankValues };

/** Cài đặt, "Tài khoản nhận tiền": the TPBank account the QR pays into. Empty number turns the QR off. */
export async function updateBankAccount(_prev: BankState, formData: FormData): Promise<BankState> {
  const { club } = await requireClub();
  const values: BankValues = {
    bank_account_no: String(formData.get("bank_account_no") ?? ""),
    bank_account_name: String(formData.get("bank_account_name") ?? ""),
  };
  let row = { bank_account_no: null as string | null, bank_account_name: null as string | null };
  if (values.bank_account_no.trim() !== "") {
    const parsed = bankSchema.safeParse(values);
    if (!parsed.success) return { error: parsed.error.issues[0].message, saved: false, values };
    row = parsed.data;
  }
  const { error } = await db()
    .from("club_settings")
    .upsert({ club_id: club.id, ...row, updated_at: new Date().toISOString() }, { onConflict: "club_id" });
  if (error) return { error: "Không lưu được. Thử lại sau.", saved: false, values };
  revalidatePath("/", "layout");
  return {
    error: null,
    saved: true,
    values: { bank_account_no: row.bank_account_no ?? "", bank_account_name: row.bank_account_name ?? "" },
  };
}

/** Người còn nợ, "Chuyển khoản cần xem": the admin has dealt with this transfer by hand. */
export async function resolveBankIssue(bankTxId: string) {
  const { club } = await requireClub();
  await db().from("bank_transactions").update({ status: "resolved" }).eq("id", bankTxId).eq("club_id", club.id);
  revalidatePath("/debts");
}
