"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireClub, todayInVietnam } from "@/lib/club";
import { listRefundable, refundMonths } from "@/lib/fee-adjust";
import { parseMember, rejoinedOnAfterEdit, readMemberForm, type MemberFormValues } from "@/lib/members";
import { db } from "@/lib/supabase";

export type MemberFormState = { error: string | null; values: MemberFormValues };

export async function createMember(_prev: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const { club } = await requireClub();
  const values = readMemberForm(formData);
  const parsed = parseMember(values);
  if ("error" in parsed) return { error: parsed.error, values };

  const { error } = await db().from("members").insert({ ...parsed.data, club_id: club.id });
  if (error) return { error: "Không lưu được. Thử lại sau.", values };
  // Back to the list: the detail screen looks like the add form, so landing there read as "not saved".
  revalidatePath("/members");
  redirect("/members");
}

export async function updateMember(
  memberId: string,
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const { userId, club } = await requireClub();
  const values = readMemberForm(formData);
  const parsed = parseMember(values);
  if ("error" in parsed) return { error: parsed.error, values };

  // club_id in the filter stops an edit from reaching another club's member.
  const { data: before } = await db()
    .from("members")
    .select("status, rejoined_on, member_type")
    .eq("id", memberId)
    .eq("club_id", club.id)
    .maybeSingle();
  if (!before) return { error: "Không tìm thấy thành viên.", values };
  const rejoined_on = rejoinedOnAfterEdit(before, parsed.data, todayInVietnam());

  // Stopped paying monthly (Nghỉ, or no longer fixed): months after this one paid ahead are paid back.
  // The form asked first (MemberForm `refund`), so the user knows the amount.
  const wasPaying = before.status === "active" && before.member_type === "fixed";
  const stillPaying = parsed.data.status === "active" && parsed.data.member_type === "fixed";
  if (wasPaying && !stillPaying) {
    const today = todayInVietnam();
    const months = await listRefundable(club.id, memberId, today.slice(0, 7));
    try {
      await refundMonths(userId, club.id, parsed.data.full_name, months, today);
    } catch {
      return { error: "Chưa hoàn được tiền các tháng đóng trước. Thử lại sau.", values };
    }
  }
  const { error } = await db()
    .from("members")
    .update({ ...parsed.data, rejoined_on, updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("club_id", club.id);
  if (error) return { error: "Không lưu được. Thử lại sau.", values };

  revalidatePath("/", "layout");
  redirect("/members");
}
