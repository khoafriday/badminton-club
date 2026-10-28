"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireClub } from "@/lib/club";
import { MIN_PASSWORD, accountMemberships, normalizeLoginId, setAccountPassword } from "@/lib/member-accounts";
import { hashPassword } from "@/lib/password";
import { currentUser } from "@/lib/session";
import { db } from "@/lib/supabase";

export type AccountFormState = { error: string | null; saved: boolean; loginId: string };

const PASSWORD_TOO_SHORT = `Mật khẩu ít nhất ${MIN_PASSWORD} ký tự.`;
const SAVE_FAILED = "Không lưu được. Thử lại sau.";

/** The member's club when they are a fixed member of the admin's current club, else null. */
async function clubMember(memberId: string): Promise<string | null> {
  const { club } = await requireClub();
  const { data } = await db()
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("club_id", club.id)
    .eq("member_type", "fixed")
    .maybeSingle();
  return data ? club.id : null;
}

async function linkedAccountId(memberId: string): Promise<string | null> {
  const { data } = await db().from("account_members").select("account_id").eq("member_id", memberId).maybeSingle();
  return data?.account_id ?? null;
}

// TK-1: the owner gives a fixed member a new login ID and a first password.
export async function createMemberAccount(
  memberId: string,
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const loginId = normalizeLoginId(String(formData.get("login_id") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!(await clubMember(memberId)))
    return { error: "Chỉ thành viên cố định mới có tài khoản.", saved: false, loginId };
  if (!/^[a-z0-9._-]{3,30}$/.test(loginId)) {
    return { error: "ID từ 3 đến 30 ký tự: chữ không dấu, số, dấu chấm, gạch.", saved: false, loginId };
  }
  if (loginId === normalizeLoginId(process.env.ADMIN_ID ?? "")) {
    return { error: "ID này đã có người dùng.", saved: false, loginId };
  }
  if (password.length < MIN_PASSWORD) return { error: PASSWORD_TOO_SHORT, saved: false, loginId };
  if (await linkedAccountId(memberId)) return { error: "Thành viên này đã có tài khoản.", saved: false, loginId };

  const { data: account, error } = await db()
    .from("accounts")
    .insert({ login_id: loginId, password_hash: await hashPassword(password) })
    .select("id")
    .single();
  if (error?.code === "23505") {
    return {
      error: "ID này đã có người dùng. Nếu là cùng một người, dùng Gắn tài khoản có sẵn.",
      saved: false,
      loginId,
    };
  }
  if (error) return { error: SAVE_FAILED, saved: false, loginId };
  const { error: linkError } = await db()
    .from("account_members")
    .insert({ member_id: memberId, account_id: account.id });
  if (linkError) return { error: SAVE_FAILED, saved: false, loginId };
  revalidatePath(`/members/${memberId}`);
  return { error: null, saved: true, loginId };
}

// TK-5: the same person plays in another club: their existing login now also opens this club.
export async function linkExistingAccount(
  memberId: string,
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const loginId = normalizeLoginId(String(formData.get("login_id") ?? ""));
  const clubId = await clubMember(memberId);
  if (!clubId) return { error: "Chỉ thành viên cố định mới có tài khoản.", saved: false, loginId };
  if (await linkedAccountId(memberId)) return { error: "Thành viên này đã có tài khoản.", saved: false, loginId };
  const { data: account } = await db().from("accounts").select("id").eq("login_id", loginId).maybeSingle();
  if (!account) return { error: "Không có tài khoản với ID này.", saved: false, loginId };
  // One login is one person, so it opens a club through one member only.
  if ((await accountMemberships(account.id)).some((m) => m.clubId === clubId)) {
    return { error: "Tài khoản này đã gắn với một thành viên khác của CLB.", saved: false, loginId };
  }
  const { error } = await db().from("account_members").insert({ member_id: memberId, account_id: account.id });
  if (error) return { error: SAVE_FAILED, saved: false, loginId };
  revalidatePath(`/members/${memberId}`);
  return { error: null, saved: true, loginId };
}

/** A new first password from the owner, for every club of this login. The member is asked to change it again. */
export async function resetMemberPassword(
  memberId: string,
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const password = String(formData.get("password") ?? "");
  const accountId = (await clubMember(memberId)) ? await linkedAccountId(memberId) : null;
  if (!accountId) return { error: "Không tìm thấy tài khoản.", saved: false, loginId: "" };
  if (password.length < MIN_PASSWORD) return { error: PASSWORD_TOO_SHORT, saved: false, loginId: "" };
  try {
    await setAccountPassword(accountId, password, false);
  } catch {
    return { error: SAVE_FAILED, saved: false, loginId: "" };
  }
  revalidatePath(`/members/${memberId}`);
  return { error: null, saved: true, loginId: "" };
}

/** Takes the login off this member. A login left with no member is deleted. */
export async function unlinkMemberAccount(memberId: string) {
  const accountId = (await clubMember(memberId)) ? await linkedAccountId(memberId) : null;
  if (!accountId) return;
  await db().from("account_members").delete().eq("member_id", memberId);
  const { count } = await db()
    .from("account_members")
    .select("member_id", { count: "exact", head: true })
    .eq("account_id", accountId);
  if ((count ?? 0) === 0) await db().from("accounts").delete().eq("id", accountId);
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
    await setAccountPassword(user.accountId, password, true);
  } catch {
    return { error: SAVE_FAILED };
  }
  redirect("/account?changed=1");
}
