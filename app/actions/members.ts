"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireClub } from "@/lib/club";
import { parseMember, readMemberForm, type MemberFormValues } from "@/lib/members";
import { db } from "@/lib/supabase";

export type MemberFormState = { error: string | null; values: MemberFormValues };

export async function createMember(_prev: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const { club } = await requireClub();
  const values = readMemberForm(formData);
  const parsed = parseMember(values);
  if ("error" in parsed) return { error: parsed.error, values };

  const { data, error } = await db()
    .from("members")
    .insert({ ...parsed.data, club_id: club.id })
    .select("id")
    .single();
  if (error) return { error: "Không lưu được. Thử lại sau.", values };
  revalidatePath("/members");
  redirect(`/members/${data.id}`);
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
  const { error } = await db()
    .from("members")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("club_id", club.id);
  if (error) return { error: "Không lưu được. Thử lại sau.", values };
  revalidatePath("/members");
  revalidatePath(`/members/${memberId}`);
  redirect("/members");
}
