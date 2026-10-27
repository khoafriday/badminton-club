// Filters the member list in the browser. Kept free of database code so it can be unit tested.

export const MEMBER_FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "fixed", label: "Đang chơi" },
  { key: "inactive", label: "Nghỉ" },
] as const;
export type MemberFilter = (typeof MEMBER_FILTERS)[number]["key"];

export type MemberRow = {
  id: string;
  full_name: string;
  gender: "male" | "female";
  phone: string | null;
  member_type: "fixed" | "guest";
  status: "active" | "inactive";
};

export function parseMemberFilter(value: unknown): MemberFilter {
  return MEMBER_FILTERS.some((f) => f.key === value) ? (value as MemberFilter) : "all";
}

/** Lower case without Vietnamese marks, so "nguyen" finds "Nguyễn". */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();
}

export function filterMembers(members: MemberRow[], filter: MemberFilter, q: string): MemberRow[] {
  const term = foldText(q.trim());
  return members.filter((m) => {
    // Đang chơi shows fixed members still playing; Nghỉ shows those who stopped.
    if (filter === "fixed" && (m.member_type !== "fixed" || m.status !== "active")) return false;
    if (filter === "inactive" && m.status !== "inactive") return false;
    if (!term) return true;
    return foldText(m.full_name).includes(term) || (m.phone ?? "").includes(term);
  });
}
