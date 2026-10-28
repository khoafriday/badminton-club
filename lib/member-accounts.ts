import "server-only";
import { hashPassword, verifyPassword } from "./password";
import { db } from "./supabase";

/** Login IDs are kept lower case, so "An.Nguyen" and "an.nguyen" are the same account. */
export function normalizeLoginId(id: string): string {
  return id.trim().toLowerCase();
}

/** A member's login when the password matches and they still play as a fixed member of a club in use. */
export async function findMemberLogin(
  id: string,
  password: string,
): Promise<{ memberId: string; passwordChanged: boolean } | null> {
  const { data, error } = await db()
    .from("member_accounts")
    .select("member_id, password_hash, password_changed, members!inner(status, member_type, clubs!inner(archived_at))")
    .eq("login_id", normalizeLoginId(id))
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const member = data.members as unknown as {
    status: string;
    member_type: string;
    clubs: { archived_at: string | null };
  };
  if (!(await verifyPassword(password, data.password_hash))) return null;
  if (member.status !== "active" || member.member_type !== "fixed" || member.clubs.archived_at) return null;
  return { memberId: data.member_id, passwordChanged: data.password_changed };
}

export type MemberAccount = { loginId: string; passwordChanged: boolean };

export async function getMemberAccount(memberId: string): Promise<MemberAccount | null> {
  const { data, error } = await db()
    .from("member_accounts")
    .select("login_id, password_changed")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) throw error;
  return data && { loginId: data.login_id, passwordChanged: data.password_changed };
}

/** The member's new password. `changedByMember` false: set by the owner, so the member is asked to change it. */
export async function setMemberPassword(memberId: string, password: string, changedByMember: boolean) {
  const { error } = await db()
    .from("member_accounts")
    .update({
      password_hash: await hashPassword(password),
      password_changed: changedByMember,
      updated_at: new Date().toISOString(),
    })
    .eq("member_id", memberId);
  if (error) throw error;
}

export const MIN_PASSWORD = 6;
