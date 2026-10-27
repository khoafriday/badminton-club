"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MEMBER_FEE_OPTION } from "@/lib/categories";
import { getPriceSettings, requireClub, todayInVietnam } from "@/lib/club";
import { listPrepayMembers, priceUnpricedSlips } from "@/lib/fees";
import { listCategories } from "@/lib/fund";
import { parseVnd } from "@/lib/money";
import { MAX_PREPAY_COUNT, oldDebts, planPrepay } from "@/lib/prepay";
import { readForm } from "@/lib/schedule-forms";
import { db } from "@/lib/supabase";

const KEYS = ["type", "category_id", "amount", "occurred_on", "description"] as const;
export type TxFormValues = Record<(typeof KEYS)[number], string> & {
  /** Only for "Thu tiền sân": who pays, which old unpaid months, and how many months from this month on. */
  member_id?: string;
  fee_ids?: string[];
  months?: string;
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
    values.months = String(formData.get("months") ?? "0");
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
 * "Thu tiền sân": marks the ticked old months and the next `months` months (from this month on) Đã nộp.
 * Months ahead with no slip yet get one at today's fee. Each slip writes its own Phí tháng line
 * through set_fee_payment, the same as on the Phí tháng screen; the lines then take the form's date and note.
 */
async function collectMemberFees(userId: string, clubId: string, values: TxFormValues): Promise<string | null> {
  const count = Number(values.months ?? "0");
  if (!values.member_id) return "Chọn thành viên.";
  if (!Number.isInteger(count) || count < 0 || count > MAX_PREPAY_COUNT) {
    return `Số tháng đóng từ 0 đến ${MAX_PREPAY_COUNT}.`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.occurred_on)) return "Chọn ngày.";

  const settings = await getPriceSettings(clubId);
  await priceUnpricedSlips(clubId, settings);
  const thisMonth = todayInVietnam().slice(0, 7);
  const member = (await listPrepayMembers(clubId, thisMonth)).find((m) => m.id === values.member_id);
  if (!member) return "Không tìm thấy thành viên.";

  const debtIds = new Set(oldDebts(member, thisMonth).map((s) => s.id));
  const feeIds = values.fee_ids ?? [];
  if (feeIds.some((id) => !debtIds.has(id))) return "Có tháng đã thu hoặc đã Miễn. Tải lại trang rồi chọn lại.";
  const ahead = planPrepay(member, thisMonth, count, settings);
  if (feeIds.length === 0 && count === 0) return "Chọn tháng còn nợ hoặc số tháng đóng.";
  if (ahead.length < count) return "Không đủ tháng để đóng trước. Giảm số tháng.";
  if (ahead.some((m) => m.amount <= 0)) return "Chưa có phí tháng. Nhập Giá tham gia trong Cài đặt trước.";

  // Months ahead that have no slip yet.
  const missing = ahead.filter((m) => m.slipId === null);
  if (missing.length > 0) {
    const { error } = await db()
      .from("membership_fees")
      .upsert(
        missing.map((m) => ({
          club_id: clubId,
          member_id: member.id,
          period_month: `${m.month}-01`,
          billing_mode: "monthly",
          amount_due: m.amount,
        })),
        { onConflict: "member_id,period_month", ignoreDuplicates: true },
      );
    if (error) return "Không lưu được. Thử lại sau.";
  }
  const { data: slips, error } = await db()
    .from("membership_fees")
    .select("id, period_month, payment_status")
    .eq("club_id", clubId)
    .eq("member_id", member.id)
    .in(
      "period_month",
      ahead.map((m) => `${m.month}-01`),
    );
  if (error) return "Không lưu được. Thử lại sau.";
  if (slips.length !== ahead.length || slips.some((s) => s.payment_status !== "unpaid")) {
    return "Có tháng vừa được thu ở chỗ khác. Tải lại trang rồi chọn lại.";
  }
  const ids = [...feeIds, ...slips.map((s) => s.id as string)];

  for (const id of ids) {
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
    .in("source_id", ids);
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
