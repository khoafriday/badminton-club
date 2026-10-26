"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MEMBER_FEE_OPTION } from "@/lib/categories";
import { requireClub } from "@/lib/club";
import { listCategories } from "@/lib/fund";
import { parseVnd } from "@/lib/money";
import { readForm } from "@/lib/schedule-forms";
import { db } from "@/lib/supabase";

const KEYS = ["type", "category_id", "amount", "occurred_on", "description"] as const;
export type TxFormValues = Record<(typeof KEYS)[number], string> & {
  /** Only for "Thu tiền sân": who pays, and which of their unpaid monthly slips. */
  member_id?: string;
  fee_ids?: string[];
};
export type TxFormState = { error: string | null; values: TxFormValues };

const txSchema = z.object({
  type: z.enum(["income", "expense"]),
  category_id: z.string().min(1, "Chọn loại."),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Chọn ngày."),
  description: z
    .string()
    .trim()
    .transform((v) => v || null),
});

/** Checks the form, including that the category is one of this club's hand-picked categories. */
async function parseTx(clubId: string, values: TxFormValues) {
  const parsed = txSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message } as const;
  const amount = parseVnd(values.amount);
  if (!amount) return { ok: false, error: "Nhập số tiền lớn hơn 0, ví dụ 200.000." } as const;
  const category = (await listCategories(clubId)).find((c) => c.id === parsed.data.category_id);
  if (!category || category.type !== parsed.data.type) return { ok: false, error: "Chọn loại." } as const;
  return { ok: true, data: { ...parsed.data, amount } } as const;
}

function done(): never {
  revalidatePath("/", "layout");
  redirect("/fund");
}

// QUY-1, QUY-2: a hand-written expense or income line.
export async function createTransaction(_prev: TxFormState, formData: FormData): Promise<TxFormState> {
  const { userId, club } = await requireClub();
  const values: TxFormValues = readForm(formData, KEYS);
  if (values.type === "income" && values.category_id === MEMBER_FEE_OPTION) {
    values.member_id = String(formData.get("member_id") ?? "");
    values.fee_ids = formData.getAll("fee_ids").map(String);
    const error = await collectMemberFees(userId, club.id, values);
    if (error) return { error, values };
    done();
  }
  const parsed = await parseTx(club.id, values);
  if (!parsed.ok) return { error: parsed.error, values };
  const { error } = await db()
    .from("transactions")
    .insert({ ...parsed.data, club_id: club.id, source_type: "manual", created_by: userId });
  if (error) return { error: "Không lưu được. Thử lại sau.", values };
  done();
}

/**
 * "Thu tiền sân": marks the chosen monthly slips Đã nộp. Each slip writes its own Phí tháng line
 * through set_fee_payment, the same as on the Phí tháng screen; the lines then take the form's date and note.
 */
async function collectMemberFees(userId: string, clubId: string, values: TxFormValues): Promise<string | null> {
  const feeIds = values.fee_ids ?? [];
  if (!values.member_id) return "Chọn thành viên.";
  if (feeIds.length === 0) return "Chọn ít nhất 1 tháng.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.occurred_on)) return "Chọn ngày.";

  const { data: slips, error } = await db()
    .from("membership_fees")
    .select("id")
    .eq("club_id", clubId)
    .eq("member_id", values.member_id)
    .eq("payment_status", "unpaid")
    .in("id", feeIds);
  if (error) return "Không lưu được. Thử lại sau.";
  if (slips.length !== feeIds.length) return "Có tháng đã thu hoặc đã Miễn. Tải lại trang rồi chọn lại.";

  for (const id of feeIds) {
    const { error: payError } = await db().rpc("set_fee_payment", {
      p_fee_id: id,
      p_paid: true,
      p_method: "cash",
      p_actor: userId,
    });
    if (payError) return "Không lưu được. Thử lại sau.";
  }
  const { error: txError } = await db()
    .from("transactions")
    .update({ occurred_on: values.occurred_on, description: values.description.trim() || null })
    .eq("club_id", clubId)
    .eq("source_type", "membership_fee")
    .in("source_id", feeIds);
  if (txError) return "Đã ghi nộp, nhưng chưa sửa được ngày và ghi chú.";
  return null;
}

/** Only hand-written lines can be edited; lines from payments follow the payment. */
export async function updateTransaction(txId: string, _prev: TxFormState, formData: FormData): Promise<TxFormState> {
  const { club } = await requireClub();
  const values = readForm(formData, KEYS);
  const parsed = await parseTx(club.id, values);
  if (!parsed.ok) return { error: parsed.error, values };
  const { error } = await db()
    .from("transactions")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", txId)
    .eq("club_id", club.id)
    .eq("source_type", "manual");
  if (error) return { error: "Không lưu được. Thử lại sau.", values };
  done();
}

export async function deleteTransaction(txId: string) {
  const { club } = await requireClub();
  await db().from("transactions").delete().eq("id", txId).eq("club_id", club.id).eq("source_type", "manual");
  done();
}
