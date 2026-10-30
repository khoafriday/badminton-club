"use server";

import { revalidatePath } from "next/cache";
import { getPriceSettings, requireClub, todayInVietnam } from "@/lib/club";
import { addMonths, formatMonthLabel } from "@/lib/dates";
import { issueFutureSlips, MAX_ISSUE_MONTHS } from "@/lib/fees";
import { getLocale } from "@/lib/i18n/server";
import { translator } from "@/lib/i18n";
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

export type IssueState = { error: string | null; notice: string | null };

/** "Tạo phiếu trước": slips of coming months, so members can be asked for a quarter or more at once. */
export async function issueFeeSlips(_prev: IssueState, formData: FormData): Promise<IssueState> {
  const { club } = await requireClub();
  const thisMonth = todayInVietnam().slice(0, 7);
  const fromMonth = String(formData.get("from_month") ?? "");
  const count = Number(formData.get("count"));
  const memberIds = formData.getAll("member").map(String);
  const locale = await getLocale();
  const t = translator(locale);
  if (!/^\d{4}-\d{2}$/.test(fromMonth) || fromMonth <= thisMonth || fromMonth > addMonths(thisMonth, MAX_ISSUE_MONTHS)) {
    return { error: "Chọn tháng bắt đầu sau tháng này.", notice: null };
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_ISSUE_MONTHS) {
    return { error: t("Chọn từ 1 đến {max} tháng.", { max: MAX_ISSUE_MONTHS }), notice: null };
  }
  if (memberIds.length === 0) return { error: "Chọn ít nhất 1 thành viên.", notice: null };

  let result;
  try {
    result = await issueFutureSlips(club.id, memberIds, fromMonth, count, await getPriceSettings(club.id));
  } catch {
    return { error: FAILED.error, notice: null };
  }
  revalidatePath("/", "layout");
  const lastMonth = addMonths(fromMonth, count - 1);
  const from = formatMonthLabel(fromMonth, locale);
  const range = count === 1 ? from : `${from} ${t("đến")} ${formatMonthLabel(lastMonth, locale)}`;
  const created = t("Đã tạo {count} phiếu cho {range}.", {
    count: result.created,
    range: locale === "en" ? range : range.toLowerCase(),
  });
  const skipped = result.skipped > 0 ? ` ${t("Bỏ qua {count} phiếu đã có.", { count: result.skipped })}` : "";
  return { error: null, notice: created + skipped };
}
