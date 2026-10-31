import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Tables } from "@/lib/testing/fake-db";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("@/lib/session", () => ({ currentUser: async () => null }));
let tables: Tables;
vi.mock("@/lib/supabase", () => ({ db: () => fakeDb(tables) }));
const club = (id: string, name: string) => ({ id, name, court_id: null, court_name: null, court_max_players: null });
vi.mock("@/lib/club", () => ({
  requireUser: async () => "khoa",
  listClubs: async () => [club("club-1", "CLB 1"), club("club-2", "CLB 2"), club("club-3", "CLB 3")],
}));

const { createAccount, deleteAccount, linkAccountMembers, unlinkAccountMember } = await import("./member-accounts");

const EMPTY = { error: null, saved: false, loginId: "" };
function form(members: string[], loginId = "an.nguyen") {
  const fd = new FormData();
  fd.append("login_id", loginId);
  fd.append("password", "123456");
  for (const id of members) fd.append("member", id);
  return fd;
}
const create = (members: string[]) => createAccount(EMPTY, form(members)).catch((e: Error) => e.message);
const loginOf = (memberId: string) => {
  const link = tables.account_members.find((l) => l.member_id === memberId);
  return tables.accounts.find((a) => a.id === link?.account_id)?.login_id;
};

beforeEach(() => {
  const fixed = { member_type: "fixed", status: "active" };
  tables = {
    members: [
      { id: "an-1", club_id: "club-1", full_name: "An", ...fixed },
      { id: "binh-1", club_id: "club-1", full_name: "Bình", ...fixed },
      { id: "an-2", club_id: "club-2", full_name: "An", ...fixed },
      { id: "an-3", club_id: "club-3", full_name: "An", ...fixed },
      { id: "an-9", club_id: "club-9", full_name: "An", ...fixed },
    ],
    accounts: [{ id: "old", login_id: "an.cu", password_hash: "x" }],
    account_members: [{ member_id: "an-3", account_id: "old" }],
  };
});

describe("a new login for several members (TK-6)", () => {
  it("opens every picked member's club, then shows the login", async () => {
    expect(await create(["an-1", "an-2"])).toMatch(/^REDIRECT \/settings\/accounts\//);
    expect(loginOf("an-1")).toBe("an.nguyen");
    expect(loginOf("an-2")).toBe("an.nguyen");
  });

  it("moves a member who already has a login, and drops the login left empty", async () => {
    await create(["an-1", "an-3"]);
    expect(loginOf("an-3")).toBe("an.nguyen");
    expect(tables.accounts.some((a) => a.id === "old")).toBe(false);
  });

  it("refuses two members of one club, none at all, or a club the owner does not have", async () => {
    expect(await create(["an-1", "binh-1"])).toMatchObject({ error: "Mỗi CLB chỉ gắn được một thành viên." });
    expect(await create([])).toMatchObject({ error: "Chọn ít nhất một thành viên." });
    expect(await create(["an-9"])).toMatchObject({
      error: "Có thành viên không gắn được. Tải lại trang rồi chọn lại.",
      members: ["an-9"],
    });
    expect(tables.accounts).toHaveLength(1);
  });
});

describe("an existing login (TK-7)", () => {
  it("gets more members, but not a second one in a club it already opens", async () => {
    expect(await linkAccountMembers("old", EMPTY, form(["an-1"]))).toMatchObject({ error: null, saved: true });
    expect(loginOf("an-1")).toBe("an.cu");
    expect(await linkAccountMembers("old", EMPTY, form(["binh-1"]))).toMatchObject({
      error: "Mỗi CLB chỉ gắn được một thành viên.",
    });
  });

  it("is deleted when its last member is taken off", async () => {
    await expect(unlinkAccountMember("old", "an-3")).rejects.toThrow("REDIRECT /settings/accounts");
    expect(tables.accounts).toHaveLength(0);
  });

  it("can be deleted by the owner", async () => {
    await expect(deleteAccount("old")).rejects.toThrow("REDIRECT /settings/accounts");
    expect(tables.accounts).toHaveLength(0);
  });
});
