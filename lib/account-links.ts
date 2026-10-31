import "server-only";
import type { Club } from "./club";
import { foldText } from "./member-filter";
import { db } from "./supabase";

/** A fixed member of another of the owner's clubs that a new login can open too. */
export type LinkCandidate = {
  memberId: string;
  name: string;
  clubId: string;
  clubName: string;
  /** The login this member already has: picking them moves them to the new one. */
  loginId: string | null;
};

/**
 * TK-6: members a new login can be given along with `memberName` of `clubId`: the active fixed members of
 * the owner's other clubs. One login opens a club through one member, so the current club is left out.
 * Members with the same name come first, since they are most likely the same person.
 */
export async function listLinkCandidates(clubs: Club[], clubId: string, memberName: string): Promise<LinkCandidate[]> {
  const others = clubs.filter((c) => c.id !== clubId);
  if (others.length === 0) return [];
  const { data: members, error } = await db()
    .from("members")
    .select("id, full_name, club_id")
    .in(
      "club_id",
      others.map((c) => c.id),
    )
    .eq("member_type", "fixed")
    .eq("status", "active");
  if (error) throw error;
  const rows = members as { id: string; full_name: string; club_id: string }[];
  if (rows.length === 0) return [];

  const { data: links, error: linkError } = await db()
    .from("account_members")
    .select("member_id, accounts!inner(login_id)")
    .in(
      "member_id",
      rows.map((m) => m.id),
    );
  if (linkError) throw linkError;
  const loginOf = new Map(
    (links as unknown as { member_id: string; accounts: { login_id: string } }[]).map((l) => [
      l.member_id,
      l.accounts.login_id,
    ]),
  );

  const clubName = new Map(others.map((c) => [c.id, c.name]));
  const same = foldText(memberName.trim());
  const order = new Map(others.map((c, i) => [c.id, i]));
  return rows
    .map((m) => ({
      memberId: m.id,
      name: m.full_name,
      clubId: m.club_id,
      clubName: clubName.get(m.club_id) ?? "",
      loginId: loginOf.get(m.id) ?? null,
    }))
    .sort(
      (a, b) =>
        Number(foldText(b.name.trim()) === same) - Number(foldText(a.name.trim()) === same) ||
        order.get(a.clubId)! - order.get(b.clubId)! ||
        a.name.localeCompare(b.name, "vi"),
    );
}

/** Null when the picks are fine: at most one member per club, none in the login's own club. */
export function checkLinkPicks(picks: { clubId: string }[], ownClubId: string): string | null {
  const clubs = new Set<string>([ownClubId]);
  for (const p of picks) {
    if (clubs.has(p.clubId)) return "Mỗi CLB chỉ gắn được một thành viên.";
    clubs.add(p.clubId);
  }
  return null;
}
