"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkLinkPicks, getOwnerAccount, listLinkCandidates, type LinkCandidate } from "@/lib/account-links";
import { listClubs, requireUser } from "@/lib/club";
import { getT } from "@/lib/i18n/server";
import { MIN_PASSWORD, normalizeLoginId, setAccountPassword } from "@/lib/member-accounts";
import { hashPassword } from "@/lib/password";
import { currentUser } from "@/lib/session";
import { db } from "@/lib/supabase";

export type AccountFormState = {
  error: string | null;
  saved: boolean;
  loginId: string;
  /** The members picked, kept when the form comes back with an error. */
  members?: string[];
};

const passwordTooShort = async () => (await getT())("Mật khẩu ít nhất {min} ký tự.", { min: MIN_PASSWORD });
const SAVE_FAILED = "Không lưu được. Thử lại sau.";
const PICK_GONE = "Có thành viên không gắn được. Tải lại trang rồi chọn lại.";

function revalidateAccounts(accountId?: string) {
  revalidatePath("/settings/accounts");
  if (accountId) revalidatePath(`/settings/accounts/${accountId}`);
  revalidatePath("/members/[id]", "page");
}

/** The picked member ids, each an active fixed member of the owner's clubs, or an error. */
async function resolvePicks(
  userId: string,
  formData: FormData,
): Promise<{ ids: string[]; picks: LinkCandidate[] | null; clubs: Awaited<ReturnType<typeof listClubs>> }> {
  const ids = [...new Set(formData.getAll("member").map(String).filter(Boolean))];
  const clubs = await listClubs(userId);
  const candidates = await listLinkCandidates(clubs);
  const picks = ids.map((id) => candidates.find((c) => c.memberId === id));
  return { ids, clubs, picks: picks.every((p) => p !== undefined) ? picks : null };
}

/** Drops the given members' links, and any login other than `keep` left with no member. */
async function unlinkMembers(memberIds: string[], keep: string) {
  if (memberIds.length === 0) return;
  const { data } = await db().from("account_members").select("account_id").in("member_id", memberIds);
  const accountIds = [...new Set((data ?? []).map((r: { account_id: string }) => r.account_id))];
  for (const id of memberIds) await db().from("account_members").delete().eq("member_id", id);
  for (const accountId of accountIds.filter((id) => id !== keep)) await deleteIfEmpty(accountId);
}

async function deleteIfEmpty(accountId: string): Promise<boolean> {
  const { count } = await db()
    .from("account_members")
    .select("member_id", { count: "exact", head: true })
    .eq("account_id", accountId);
  if ((count ?? 0) > 0) return false;
  await db().from("accounts").delete().eq("id", accountId);
  return true;
}

/** Links the members to the login; a member with another login is moved off it. */
async function attachMembers(accountId: string, picks: LinkCandidate[]): Promise<boolean> {
  try {
    await unlinkMembers(
      picks.filter((p) => p.accountId).map((p) => p.memberId),
      accountId,
    );
  } catch {
    return false;
  }
  for (const p of picks) {
    const { error } = await db().from("account_members").insert({ member_id: p.memberId, account_id: accountId });
    if (error) return false;
  }
  return true;
}

// TK-1, TK-6: the owner makes a login with a first password and gives it to one or more members, one per club.
// A picked member who already has a login is moved to the new one; the old login goes if no member is left on it.
export async function createAccount(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const userId = await requireUser();
  const loginId = normalizeLoginId(String(formData.get("login_id") ?? ""));
  const password = String(formData.get("password") ?? "");
  const { ids, picks } = await resolvePicks(userId, formData);
  const fail = (error: string): AccountFormState => ({ error, saved: false, loginId, members: ids });
  if (!/^[a-z0-9._-]{3,30}$/.test(loginId)) {
    return fail("ID từ 3 đến 30 ký tự: chữ không dấu, số, dấu chấm, gạch.");
  }
  if (loginId === normalizeLoginId(process.env.ADMIN_ID ?? "")) return fail("ID này đã có người dùng.");
  if (password.length < MIN_PASSWORD) return fail(await passwordTooShort());
  if (ids.length === 0) return fail("Chọn ít nhất một thành viên.");
  if (!picks) return fail(PICK_GONE);
  const clash = checkLinkPicks(picks);
  if (clash) return fail(clash);

  const { data: account, error } = await db()
    .from("accounts")
    .insert({ login_id: loginId, password_hash: await hashPassword(password) })
    .select("id")
    .single();
  if (error?.code === "23505") return fail("ID này đã có người dùng. Mở tài khoản đó để gắn thêm thành viên.");
  if (error) return fail(SAVE_FAILED);
  if (!(await attachMembers(account.id, picks))) return fail(SAVE_FAILED);
  revalidateAccounts(account.id);
  redirect(`/settings/accounts/${account.id}`);
}

// TK-5, TK-6: the same person plays in more clubs: the login now opens those clubs too.
export async function linkAccountMembers(
  accountId: string,
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const userId = await requireUser();
  const { ids, picks, clubs } = await resolvePicks(userId, formData);
  const fail = (error: string): AccountFormState => ({ error, saved: false, loginId: "", members: ids });
  const account = await getOwnerAccount(clubs, accountId);
  if (!account) return fail("Không tìm thấy tài khoản.");
  if (ids.length === 0) return fail("Chọn ít nhất một thành viên.");
  if (!picks || picks.some((p) => p.accountId === accountId)) return fail(PICK_GONE);
  const clash = checkLinkPicks(
    picks,
    account.members.map((m) => m.clubId),
  );
  if (clash) return fail(clash);
  if (!(await attachMembers(accountId, picks))) return fail(SAVE_FAILED);
  revalidateAccounts(accountId);
  return { error: null, saved: true, loginId: "" };
}

/** Takes one member off the login. A login left with no member is deleted. */
export async function unlinkAccountMember(accountId: string, memberId: string) {
  const userId = await requireUser();
  const account = await getOwnerAccount(await listClubs(userId), accountId);
  if (!account?.members.some((m) => m.memberId === memberId)) return;
  await db().from("account_members").delete().eq("member_id", memberId).eq("account_id", accountId);
  revalidateAccounts(accountId);
  if (await deleteIfEmpty(accountId)) redirect("/settings/accounts");
}

/** A new first password from the owner, for every club of this login. The member is asked to change it again. */
export async function resetAccountPassword(
  accountId: string,
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const userId = await requireUser();
  const password = String(formData.get("password") ?? "");
  if (!(await getOwnerAccount(await listClubs(userId), accountId))) {
    return { error: "Không tìm thấy tài khoản.", saved: false, loginId: "" };
  }
  if (password.length < MIN_PASSWORD) return { error: await passwordTooShort(), saved: false, loginId: "" };
  try {
    await setAccountPassword(accountId, password, false);
  } catch {
    return { error: SAVE_FAILED, saved: false, loginId: "" };
  }
  revalidateAccounts(accountId);
  return { error: null, saved: true, loginId: "" };
}

/** Deletes the login and every link it has. The members stay. */
export async function deleteAccount(accountId: string) {
  const userId = await requireUser();
  if (!(await getOwnerAccount(await listClubs(userId), accountId))) return;
  await db().from("accounts").delete().eq("id", accountId);
  revalidateAccounts();
  redirect("/settings/accounts");
}

export type ChangePasswordState = { error: string | null };

// TK-3: a member changes their own password. After that they are not asked again.
export async function changeOwnPassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const user = await currentUser();
  if (user?.kind !== "member") redirect("/");
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD) return { error: await passwordTooShort() };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "Hai lần nhập mật khẩu không giống nhau." };
  try {
    await setAccountPassword(user.accountId, password, true);
  } catch {
    return { error: SAVE_FAILED };
  }
  redirect("/account?changed=1");
}
