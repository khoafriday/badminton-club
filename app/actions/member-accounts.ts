"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireClub } from "@/lib/club";
import { MIN_PASSWORD, normalizeLoginId, setMemberPassword } from "@/lib/member-accounts";
import { hashPassword } from "@/lib/password";
import { currentUser } from "@/lib/session";
import { db } from "@/lib/supabase";

export type AccountFormState = {
  error: string | null;
  saved: boolean;
  loginId: string;
};

const PASSWORD_TOO_SHORT = `Mật khẩu ít nhất ${MIN_PASSWORD} ký tự.`;

/** The member must be a fixed member of the admin's current club. */
async function clubMember(memberId: string) {
  const { club } = await requireClub();
  const { data } = await db()
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("club_id", club.id)
    .eq("member_type", "fixed")
    .maybeSingle();
  return data !== null;
}

// TK-1: the owner gives a fixed member a login ID and a first password.
export async function createMemberAccount(
  memberId: string,
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const loginId = normalizeLoginId(String(formData.get("login_id") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!(await clubMember(memberId)))
    return {
      error: "Chỉ thành viên cố định mới có tài khoản.",
      saved: false,
      loginId,
    };
  if (!/^[a-z0-9._-]{3,30}$/.test(loginId)) {
    return {
      error: "ID từ 3 đến 30 ký tự: chữ không dấu, số, dấu chấm, gạch.",
      saved: false,
      loginId,
    };
  }
  if (loginId === normalizeLoginId(process.env.ADMIN_ID ?? ""))
    return { error: "ID này đã có người dùng.", saved: false, loginId };
  if (password.length < MIN_PASSWORD) return { error: PASSWORD_TOO_SHORT, saved: false, loginId };

  const { error } = await db()
    .from("member_accounts")
    .insert({
      member_id: memberId,
      login_id: loginId,
      password_hash: await hashPassword(password),
    });
  if (error?.code === "23505")
    return {
      error: "ID này đã có người dùng, hoặc thành viên đã có tài khoản.",
      saved: false,
      loginId,
    };
  if (error) return { error: "Không lưu được. Thử lại sau.", saved: false, loginId };
  revalidatePath(`/members/${memberId}`);
  return { error: null, saved: true, loginId };
}

/** A new first password from the owner, for example when the member forgot theirs. They are asked to change it again. */
export async function resetMemberPassword(
  memberId: string,
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const password = String(formData.get("password") ?? "");
  if (!(await clubMember(memberId))) return { error: "Không tìm thấy thành viên.", saved: false, loginId: "" };
  if (password.length < MIN_PASSWORD) return { error: PASSWORD_TOO_SHORT, saved: false, loginId: "" };
  try {
    await setMemberPassword(memberId, password, false);
  } catch {
    return { error: "Không lưu được. Thử lại sau.", saved: false, loginId: "" };
  }
  revalidatePath(`/members/${memberId}`);
  return { error: null, saved: true, loginId: "" };
}

export async function deleteMemberAccount(memberId: string) {
  if (!(await clubMember(memberId))) return;
  await db().from("member_accounts").delete().eq("member_id", memberId);
  revalidatePath(`/members/${memberId}`);
}

export type ChangePasswordState = { error: string | null };

// TK-3: a member changes their own password. After that they are not asked again.
export async function changeOwnPassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const user = await currentUser();
  if (user?.kind !== "member") redirect("/");
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD) return { error: PASSWORD_TOO_SHORT };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "Hai lần nhập mật khẩu không giống nhau." };
  try {
    await setMemberPassword(user.memberId, password, true);
  } catch {
    return { error: "Không lưu được. Thử lại sau." };
  }
  redirect("/account?changed=1");
}
