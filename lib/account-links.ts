import "server-only";
import type { Club } from "./club";
import { foldText } from "./member-filter";
import { db } from "./supabase";

/** An active fixed member of one of the owner's clubs, with the login they already have. */
export type LinkCandidate = {
  memberId: string;
  name: string;
  clubId: string;
  clubName: string;
  /** The login this member already has: picking them for another one moves them there. */
  loginId: string | null;
  accountId: string | null;
};

/**
 * TK-6: the members a login can be given: the active fixed members of the owner's clubs, club by club.
 * Members named like `nameFirst` come first, since they are most likely the same person.
 */
export async function listLinkCandidates(clubs: Club[], nameFirst = ""): Promise<LinkCandidate[]> {
  if (clubs.length === 0) return [];
  const { data: members, error } = await db()
    .from("members")
    .select("id, full_name, club_id")
    .in(
      "club_id",
      clubs.map((c) => c.id),
    )
    .eq("member_type", "fixed")
    .eq("status", "active");
  if (error) throw error;
  const rows = members as { id: string; full_name: string; club_id: string }[];
  if (rows.length === 0) return [];

  const { data: links, error: linkError } = await db()
    .from("account_members")
    .select("member_id, account_id, accounts!inner(login_id)")
    .in(
      "member_id",
      rows.map((m) => m.id),
    );
  if (linkError) throw linkError;
  type Link = { member_id: string; account_id: string; accounts: { login_id: string } };
  const linkOf = new Map((links as unknown as Link[]).map((l) => [l.member_id, l]));

  const clubName = new Map(clubs.map((c) => [c.id, c.name]));
  const order = new Map(clubs.map((c, i) => [c.id, i]));
  const same = foldText(nameFirst.trim());
  const isSame = (name: string) => Number(same !== "" && foldText(name.trim()) === same);
  return rows
    .map((m) => ({
      memberId: m.id,
      name: m.full_name,
      clubId: m.club_id,
      clubName: clubName.get(m.club_id) ?? "",
      loginId: linkOf.get(m.id)?.accounts.login_id ?? null,
      accountId: linkOf.get(m.id)?.account_id ?? null,
    }))
    .sort(
      (a, b) =>
        isSame(b.name) - isSame(a.name) ||
        order.get(a.clubId)! - order.get(b.clubId)! ||
        a.name.localeCompare(b.name, "vi"),
    );
}

/** Null when the picks are fine: at most one member per club, none in a club the login already opens. */
export function checkLinkPicks(picks: { clubId: string }[], takenClubIds: string[] = []): string | null {
  const clubs = new Set(takenClubIds);
  for (const p of picks) {
    if (clubs.has(p.clubId)) return "Mỗi CLB chỉ gắn được một thành viên.";
    clubs.add(p.clubId);
  }
  return null;
}

export type OwnerAccount = {
  id: string;
  loginId: string;
  passwordChanged: boolean;
  lastLoginAt: string | null;
  /** Its members in the owner's clubs, in club order. */
  members: { memberId: string; name: string; clubId: string; clubName: string; status: string }[];
};

/** Every login that opens at least one of the owner's clubs, by login ID. */
export async function listOwnerAccounts(clubs: Club[]): Promise<OwnerAccount[]> {
  if (clubs.length === 0) return [];
  const { data, error } = await db()
    .from("account_members")
    .select(
      "member_id, account_id, accounts!inner(login_id, password_changed, last_login_at), members!inner(full_name, club_id, status)",
    )
    .in(
      "members.club_id",
      clubs.map((c) => c.id),
    );
  if (error) throw error;
  type Row = {
    member_id: string;
    account_id: string;
    accounts: { login_id: string; password_changed: boolean; last_login_at: string | null };
    members: { full_name: string; club_id: string; status: string };
  };
  const clubName = new Map(clubs.map((c) => [c.id, c.name]));
  const order = new Map(clubs.map((c, i) => [c.id, i]));
  const byId = new Map<string, OwnerAccount>();
  for (const r of data as unknown as Row[]) {
    const account = byId.get(r.account_id) ?? {
      id: r.account_id,
      loginId: r.accounts.login_id,
      passwordChanged: r.accounts.password_changed,
      lastLoginAt: r.accounts.last_login_at ?? null,
      members: [],
    };
    account.members.push({
      memberId: r.member_id,
      name: r.members.full_name,
      clubId: r.members.club_id,
      clubName: clubName.get(r.members.club_id) ?? "",
      status: r.members.status,
    });
    byId.set(r.account_id, account);
  }
  const accounts = [...byId.values()];
  for (const a of accounts) a.members.sort((x, y) => order.get(x.clubId)! - order.get(y.clubId)!);
  return accounts.sort((a, b) => a.loginId.localeCompare(b.loginId));
}

/** One login of the owner's, or null when it opens none of their clubs. */
export async function getOwnerAccount(clubs: Club[], accountId: string): Promise<OwnerAccount | null> {
  return (await listOwnerAccounts(clubs)).find((a) => a.id === accountId) ?? null;
}

/** "31/10/2026 08:05" in Vietnam time. */
export function formatLoginTime(timestamp: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
  return parts.replace(",", "");
}
