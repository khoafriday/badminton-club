"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireClub } from "@/lib/club";
import { listCategories } from "@/lib/fund";
import { parseVnd } from "@/lib/money";
import { readForm } from "@/lib/schedule-forms";
import { db } from "@/lib/supabase";

const KEYS = ["type", "category_id", "amount", "occurred_on", "description"] as const;
export type TxFormValues = Record<(typeof KEYS)[number], string>;
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
  const values = readForm(formData, KEYS);
  const parsed = await parseTx(club.id, values);
  if (!parsed.ok) return { error: parsed.error, values };
  const { error } = await db()
    .from("transactions")
    .insert({ ...parsed.data, club_id: club.id, source_type: "manual", created_by: userId });
  if (error) return { error: "Không lưu được. Thử lại sau.", values };
  done();
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
