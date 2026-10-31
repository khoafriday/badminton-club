import { describe, expect, it } from "vitest";
import { memberCandidates, searchCandidates, type CandidateRow } from "./member-candidates";

const row = (over: Partial<CandidateRow>): CandidateRow => ({
  id: over.full_name ?? "x",
  club_id: "other",
  club_name: "CLB Tối",
  full_name: "x",
  nickname: null,
  gender: "male",
  phone: null,
  member_type: "fixed",
  updated_at: "2026-10-01",
  account_id: null,
  ...over,
});

const names = (rows: { full_name: string }[]) => rows.map((r) => r.full_name);

describe("memberCandidates", () => {
  it("lists people from other clubs and guests here, not fixed members here", () => {
    const list = memberCandidates(
      [
        row({ full_name: "An", club_id: "here", club_name: "CLB Sáng" }),
        row({ full_name: "Bình", club_id: "here", member_type: "guest" }),
        row({ full_name: "Cường" }),
      ],
      "here",
    );
    expect(names(list)).toEqual(["Bình", "Cường"]);
    expect(list[0]).toMatchObject({ guestHere: true, clubs: [] });
    expect(list[1]).toMatchObject({ guestHere: false, clubs: ["CLB Tối"] });
  });

  it("leaves out a name a fixed member here already has, and anyone sharing their login", () => {
    const list = memberCandidates(
      [
        row({ id: "an-here", full_name: "Nguyễn An", club_id: "here", account_id: "acc-1" }),
        row({ id: "an-2", full_name: "nguyen  an" }),
        row({ id: "an-3", full_name: "An Nguyễn", account_id: "acc-1" }),
        row({ id: "dung", full_name: "Dũng" }),
      ],
      "here",
    );
    expect(names(list)).toEqual(["Dũng"]);
  });

  it("shows one line per person in several clubs, from the latest fixed row", () => {
    const list = memberCandidates(
      [
        row({ id: "old", full_name: "Hà", club_name: "CLB A", account_id: "acc", updated_at: "2026-01-01" }),
        row({ id: "new", full_name: "Hà", club_id: "b", club_name: "CLB B", account_id: "acc", nickname: "Hà Lùn", updated_at: "2026-09-01" }),
        row({ id: "guest", full_name: "Hà", club_id: "c", club_name: "CLB C", account_id: "acc", member_type: "guest", updated_at: "2026-10-01" }),
      ],
      "here",
    );
    expect(list).toEqual([
      expect.objectContaining({ id: "new", nickname: "Hà Lùn", clubs: ["CLB A", "CLB B", "CLB C"] }),
    ]);
  });

  it("keeps two people with the same name apart when their phones differ", () => {
    const list = memberCandidates(
      [row({ id: "a", full_name: "Tuấn", phone: "0901" }), row({ id: "b", full_name: "Tuấn", phone: "0902" })],
      "here",
    );
    expect(list.map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("searchCandidates", () => {
  const list = memberCandidates(
    [
      row({ full_name: "Nguyễn Văn An", nickname: "Út", phone: "0901 234 567" }),
      row({ full_name: "Đỗ Bình", club_id: "x" }),
    ],
    "here",
  );

  it("matches any part of the name or nickname, without marks", () => {
    expect(names(searchCandidates(list, "van a"))).toEqual(["Nguyễn Văn An"]);
    expect(names(searchCandidates(list, "ut"))).toEqual(["Nguyễn Văn An"]);
    expect(names(searchCandidates(list, "do"))).toEqual(["Đỗ Bình"]);
  });

  it("matches a phone number typed without spaces", () => {
    expect(names(searchCandidates(list, "1234"))).toEqual(["Nguyễn Văn An"]);
  });

  it("lists everyone when nothing is typed", () => {
    expect(searchCandidates(list, " ")).toHaveLength(2);
  });
});
