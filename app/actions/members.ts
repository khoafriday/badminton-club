"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listClubs, requireClub, todayInVietnam } from "@/lib/club";
import { dropIssuedSlips, listRefundable, refundMonths } from "@/lib/fee-adjust";
import { parseFixedSince, parseMember, rejoinedOnAfterEdit, readMemberForm, type MemberFormValues } from "@/lib/members";
import { db } from "@/lib/supabase";

export type MemberFormState = { error: string | null; values: MemberFormValues };

const NAME_TAKEN = "CLB đã có thành viên cố định tên này. Đặt tên khác, ví dụ thêm họ hoặc số.";

/** Same name in the same club, ignoring case and extra spaces. Guests do not count: they are only suggestions. */
async function fixedNameTaken(clubId: string, name: string, exceptId?: string): Promise<boolean> {
  const key = (text: string) => text.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
  const { data, error } = await db()
    .from("members")
    .select("id, full_name")
    .eq("club_id", clubId)
    .eq("member_type", "fixed");
  if (error) throw error;
  return data.some((m) => m.id !== exceptId && key(m.full_name) === key(name));
}

/**
 * Someone already in the app, picked from the list on Thêm thành viên. A guest of this club becomes fixed on the
 * same row, so their sessions stay theirs. A member of another club is copied into this one and keeps their login
 * (TK: one login for every club the person plays in).
 */
async function addExistingMember(userId: string, clubId: string, values: MemberFormValues): Promise<MemberFormState> {
  const fixedSince = parseFixedSince(values.fixed_since);
  if ("error" in fixedSince) return { error: fixedSince.error, values };
  const clubIds = (await listClubs(userId)).map((c) => c.id);
  const { data: source, error: readError } = await db()
    .from("members")
    .select("id, club_id, full_name, nickname, gender, phone, member_type")
    .eq("id", values.source_member_id)
    .in("club_id", clubIds)
    .maybeSingle();
  if (readError) throw readError;
  if (!source || (source.club_id === clubId && source.member_type === "fixed")) {
    return { error: "Không tìm thấy thành viên.", values };
  }
  if (await fixedNameTaken(clubId, source.full_name)) return { error: NAME_TAKEN, values };

  const fixed = { member_type: "fixed", status: "active", fixed_since: fixedSince.data, rejoined_on: null };
  if (source.club_id === clubId) {
    const { error } = await db()
      .from("members")
      .update({ ...fixed, updated_at: new Date().toISOString() })
      .eq("id", source.id)
      .eq("club_id", clubId);
    if (error) return { error: "Không lưu được. Thử lại sau.", values };
    return { error: null, values };
  }

  const id = crypto.randomUUID();
  const { error } = await db()
    .from("members")
    .insert({
      id,
      club_id: clubId,
      full_name: source.full_name,
      nickname: source.nickname,
      gender: source.gender,
      phone: source.phone,
      ...fixed,
    });
  if (error) return { error: "Không lưu được. Thử lại sau.", values };
  const { data: link, error: linkError } = await db()
    .from("account_members")
    .select("account_id")
    .eq("member_id", source.id)
    .maybeSingle();
  if (linkError) throw linkError;
  // The member is saved either way; a login that failed to link can still be linked from their detail screen.
  if (link) await db().from("account_members").insert({ member_id: id, account_id: link.account_id });
  return { error: null, values };
}

export async function createMember(_prev: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const { userId, club } = await requireClub();
  const values = readMemberForm(formData);
  if (values.source_member_id) {
    const added = await addExistingMember(userId, club.id, values);
    if (added.error) return added;
    revalidatePath("/members");
    redirect("/members");
  }
  const parsed = parseMember(values);
  if ("error" in parsed) return { error: parsed.error, values };
  if (parsed.data.member_type === "fixed" && (await fixedNameTaken(club.id, parsed.data.full_name))) {
    return { error: NAME_TAKEN, values };
  }

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
  if (parsed.data.member_type === "fixed" && (await fixedNameTaken(club.id, parsed.data.full_name, memberId))) {
    return { error: NAME_TAKEN, values };
  }
  const rejoined_on = rejoinedOnAfterEdit(before, parsed.data, todayInVietnam());

  // Stopped paying monthly (Nghỉ, or no longer fixed): months after this one paid ahead are paid back,
  // and months made ahead but not paid are removed.
  // The form asked first (MemberForm `refund`), so the user knows the amount.
  const wasPaying = before.status === "active" && before.member_type === "fixed";
  const stillPaying = parsed.data.status === "active" && parsed.data.member_type === "fixed";
  if (wasPaying && !stillPaying) {
    const today = todayInVietnam();
    const months = await listRefundable(club.id, memberId, today.slice(0, 7));
    try {
      await refundMonths(userId, club.id, parsed.data.full_name, months, today);
      await dropIssuedSlips(club.id, memberId, today.slice(0, 7));
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
