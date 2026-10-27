"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireClub, todayInVietnam } from "@/lib/club";
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
  const { club } = await requireClub();
  const values = readMemberForm(formData);
  const parsed = parseMember(values);
  if ("error" in parsed) return { error: parsed.error, values };

  // club_id in the filter stops an edit from reaching another club's member.
  const { data: before } = await db()
    .from("members")
    .select("status, rejoined_on")
    .eq("id", memberId)
    .eq("club_id", club.id)
    .maybeSingle();
  if (!before) return { error: "Không tìm thấy thành viên.", values };
  const rejoined_on = rejoinedOnAfterEdit(before, parsed.data, todayInVietnam());

  const { error } = await db()
    .from("members")
    .update({ ...parsed.data, rejoined_on, updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("club_id", club.id);
  if (error) return { error: "Không lưu được. Thử lại sau.", values };
  revalidatePath("/members");
  revalidatePath(`/members/${memberId}`);
  redirect("/members");
}
