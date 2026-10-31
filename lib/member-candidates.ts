// People already in the app who can be added to the current club as fixed members, without typing them again.
// Kept free of database code so it can be unit tested.
import { foldText } from "./member-filter";

/** One member row from any of the owner's clubs, with its club name and login (if linked). */
export type CandidateRow = {
  id: string;
  club_id: string;
  club_name: string;
  full_name: string;
  nickname: string | null;
  gender: "male" | "female";
  phone: string | null;
  member_type: "fixed" | "guest";
  updated_at: string;
  account_id: string | null;
};

export type Candidate = {
  /** The member row the new one is copied from, or the guest row turned fixed when it is in this club. */
  id: string;
  full_name: string;
  nickname: string | null;
  gender: "male" | "female";
  phone: string | null;
  /** Clubs the person is in, current club last when they only came there as a guest. */
  clubs: string[];
  /** Came to this club as a guest: picking them turns that row into a fixed member, keeping their sessions. */
  guestHere: boolean;
};

const nameKey = (name: string) => foldText(name.trim().replace(/\s+/g, " "));

/**
 * Everyone not yet a fixed member of `clubId`. Rows sharing a login are one person; rows without one are
 * one person when name, gender and phone match. Someone whose name a fixed member here already uses is left
 * out, since adding them would fail the same-name check.
 */
export function memberCandidates(rows: CandidateRow[], clubId: string): Candidate[] {
  const here = rows.filter((r) => r.club_id === clubId && r.member_type === "fixed");
  const takenNames = new Set(here.map((r) => nameKey(r.full_name)));
  const takenAccounts = new Set(here.map((r) => r.account_id).filter(Boolean));

  const groups = new Map<string, CandidateRow[]>();
  for (const r of rows) {
    if (r.club_id === clubId && r.member_type === "fixed") continue;
    const key = r.account_id ?? `${nameKey(r.full_name)}|${r.gender}|${(r.phone ?? "").replace(/\D/g, "")}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const out: Candidate[] = [];
  for (const group of groups.values()) {
    if (group.some((r) => r.account_id && takenAccounts.has(r.account_id))) continue;
    // A guest row here is reused so their sessions stay with them; otherwise copy the latest fixed row.
    const source =
      group.find((r) => r.club_id === clubId) ??
      [...group].sort(
        (a, b) =>
          Number(b.member_type === "fixed") - Number(a.member_type === "fixed") ||
          b.updated_at.localeCompare(a.updated_at),
      )[0];
    if (takenNames.has(nameKey(source.full_name))) continue;
    const others = [...new Set(group.filter((r) => r.club_id !== clubId).map((r) => r.club_name))];
    out.push({
      id: source.id,
      full_name: source.full_name,
      nickname: group.find((r) => r.nickname)?.nickname ?? null,
      gender: source.gender,
      phone: source.phone,
      clubs: others,
      guestHere: source.club_id === clubId,
    });
  }
  return out.sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));
}

/** Any part of the name, nickname or phone, ignoring case and Vietnamese marks. */
export function searchCandidates(candidates: Candidate[], q: string): Candidate[] {
  const term = foldText(q.trim());
  if (!term) return candidates;
  return candidates.filter(
    (c) =>
      foldText(c.full_name).includes(term) ||
      (c.nickname !== null && foldText(c.nickname).includes(term)) ||
      (c.phone ?? "").replace(/\D/g, "").includes(term.replace(/\D/g, "") || "\0"),
  );
}
