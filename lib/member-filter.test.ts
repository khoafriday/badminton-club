import { describe, expect, it } from "vitest";
import { filterMembers, parseMemberFilter, type MemberRow } from "./member-filter";

const member = (over: Partial<MemberRow>): MemberRow => ({
  id: over.full_name ?? "x",
  full_name: "x",
  gender: "male",
  phone: null,
  member_type: "fixed",
  status: "active",
  ...over,
});

const members = [
  member({ full_name: "Nguyễn Văn An", phone: "0901 234 567" }),
  member({ full_name: "Đỗ Thị Bình", gender: "female", member_type: "guest" }),
  member({ full_name: "Trần Cường", status: "inactive" }),
];
const names = (rows: MemberRow[]) => rows.map((m) => m.full_name);

describe("filterMembers", () => {
  it("keeps only fixed members still playing under Đang chơi", () => {
    expect(names(filterMembers(members, "fixed", ""))).toEqual(["Nguyễn Văn An"]);
  });

  it("shows people who stopped under Nghỉ", () => {
    expect(names(filterMembers(members, "inactive", ""))).toEqual(["Trần Cường"]);
  });

  it("finds a name typed without marks, and a phone number", () => {
    expect(names(filterMembers(members, "all", "nguyen"))).toEqual(["Nguyễn Văn An"]);
    expect(names(filterMembers(members, "all", "do thi"))).toEqual(["Đỗ Thị Bình"]);
    expect(names(filterMembers(members, "all", "234"))).toEqual(["Nguyễn Văn An"]);
  });

  it("falls back to Tất cả for an unknown filter", () => {
    expect(parseMemberFilter("nope")).toBe("all");
    expect(parseMemberFilter("inactive")).toBe("inactive");
    // Guests are no longer listed, so an old ?filter=guest link opens Tất cả.
    expect(parseMemberFilter("guest")).toBe("all");
  });
});
