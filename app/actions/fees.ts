"use server";

import { revalidatePath } from "next/cache";
import { requireClub } from "@/lib/club";
import { db } from "@/lib/supabase";

export type FeeResult = { error: string | null };
const FAILED = { error: "Không lưu được. Thử lại sau." };

async function slipInClub(clubId: string, feeId: string) {
  const { data } = await db()
    .from("membership_fees")
    .select("id, payment_status")
    .eq("id", feeId)
    .eq("club_id", clubId)
    .maybeSingle();
  return data;
}

/** TT-3: Đã nộp / Chưa nộp for a monthly fee slip. The database function keeps the ledger in step. */
export async function setFeePaid(feeId: string, paid: boolean): Promise<FeeResult> {
  const { userId, club } = await requireClub();
  if (!(await slipInClub(club.id, feeId))) return { error: "Không tìm thấy phiếu." };
  const { error } = await db().rpc("set_fee_payment", {
    p_fee_id: feeId,
    p_paid: paid,
    p_method: "cash",
    p_actor: userId,
  });
  if (error) return FAILED;
  revalidatePath("/", "layout");
  return { error: null };
}

/** Miễn / bỏ Miễn. A paid slip must be set back to Chưa nộp first, so the ledger stays right. */
export async function setFeeWaived(feeId: string, waived: boolean): Promise<FeeResult> {
  const { club } = await requireClub();
  const slip = await slipInClub(club.id, feeId);
  if (!slip) return { error: "Không tìm thấy phiếu." };
  if (slip.payment_status === "paid") return { error: "Phiếu đã nộp. Bỏ Đã nộp trước khi Miễn." };
  const { error } = await db()
    .from("membership_fees")
    .update({
      payment_status: waived ? "waived" : "unpaid",
      waive_reason: waived ? "manual" : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", feeId);
  if (error) return FAILED;
  revalidatePath("/", "layout");
  return { error: null };
}
