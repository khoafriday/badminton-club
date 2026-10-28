import "server-only";
import { hashPassword, verifyPassword } from "./password";
import { db } from "./supabase";

/** Login IDs are kept lower case, so "An.Nguyen" and "an.nguyen" are the same account. */
export function normalizeLoginId(id: string): string {
  return id.trim().toLowerCase();
}

export const MIN_PASSWORD = 6;

/** The account when the password matches and it is linked to at least one member who still plays. */
export async function findAccountLogin(
  id: string,
  password: string,
): Promise<{ accountId: string; passwordChanged: boolean } | null> {
  const { data, error } = await db()
    .from("accounts")
    .select("id, password_hash, password_changed")
    .eq("login_id", normalizeLoginId(id))
    .maybeSingle();
  if (error) throw error;
  if (!data || !(await verifyPassword(password, data.password_hash))) return null;
  if ((await accountMemberships(data.id)).length === 0) return null;
  return { accountId: data.id, passwordChanged: data.password_changed };
}

export type Membership = { memberId: string; name: string; clubId: string };

/** The member rows an account can see: active fixed members of clubs still in use, oldest link first. */
export async function accountMemberships(accountId: string): Promise<Membership[]> {
  const { data, error } = await db()
    .from("account_members")
    .select("member_id, members!inner(full_name, status, member_type, club_id, clubs!inner(archived_at))")
    .eq("account_id", accountId)
    .order("created_at");
  if (error) throw error;
  type Row = {
    member_id: string;
    members: {
      full_name: string;
      status: string;
      member_type: string;
      club_id: string;
      clubs: { archived_at: string | null };
    };
  };
  return (data as unknown as Row[])
    .filter((r) => r.members.status === "active" && r.members.member_type === "fixed" && !r.members.clubs.archived_at)
    .map((r) => ({ memberId: r.member_id, name: r.members.full_name, clubId: r.members.club_id }));
}

export type MemberAccount = {
  accountId: string;
  loginId: string;
  passwordChanged: boolean;
  /** How many members (one per club) share this login. */
  linkCount: number;
};

/** The login linked to a member row, if any. */
export async function getMemberAccount(memberId: string): Promise<MemberAccount | null> {
  const { data, error } = await db()
    .from("account_members")
    .select("account_id, accounts!inner(login_id, password_changed)")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const account = data.accounts as unknown as { login_id: string; password_changed: boolean };
  const { count } = await db()
    .from("account_members")
    .select("member_id", { count: "exact", head: true })
    .eq("account_id", data.account_id);
  return {
    accountId: data.account_id,
    loginId: account.login_id,
    passwordChanged: account.password_changed,
    linkCount: count ?? 1,
  };
}

export async function getAccount(accountId: string) {
  const { data, error } = await db()
    .from("accounts")
    .select("id, login_id, password_changed, last_club_id")
    .eq("id", accountId)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; login_id: string; password_changed: boolean; last_club_id: string | null } | null;
}

/** A new password. `changedByMember` false: set by the owner, so the member is asked to change it. */
export async function setAccountPassword(accountId: string, password: string, changedByMember: boolean) {
  const { error } = await db()
    .from("accounts")
    .update({
      password_hash: await hashPassword(password),
      password_changed: changedByMember,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);
  if (error) throw error;
}
