import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Tables } from "@/lib/testing/fake-db";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => {} }));
vi.mock("@/lib/session", () => ({ currentUser: async () => null }));
let tables: Tables;
vi.mock("@/lib/supabase", () => ({ db: () => fakeDb(tables) }));
const club = (id: string, name: string) => ({ id, name, court_id: null, court_name: null, court_max_players: null });
vi.mock("@/lib/club", () => ({
  requireClub: async () => ({ userId: "khoa", club: club("club-1", "CLB 1") }),
  listClubs: async () => [club("club-1", "CLB 1"), club("club-2", "CLB 2"), club("club-3", "CLB 3")],
}));

const { createMemberAccount } = await import("./member-accounts");

function create(alsoLink: string[]) {
  const fd = new FormData();
  fd.append("login_id", "an.nguyen");
  fd.append("password", "123456");
  for (const id of alsoLink) fd.append("also_link", id);
  return createMemberAccount("an-1", { error: null, saved: false, loginId: "" }, fd);
}
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
      { id: "cuong-2", club_id: "club-2", full_name: "Cường", ...fixed },
      { id: "an-3", club_id: "club-3", full_name: "An", ...fixed },
      { id: "an-9", club_id: "club-9", full_name: "An", ...fixed },
    ],
    accounts: [{ id: "old", login_id: "an.cu", password_hash: "x" }],
    account_members: [{ member_id: "an-3", account_id: "old" }],
  };
});

describe("a new login for several members (TK-6)", () => {
  it("opens the other clubs through the picked members", async () => {
    const state = await create(["an-2"]);
    expect(state.error).toBeNull();
    expect(loginOf("an-1")).toBe("an.nguyen");
    expect(loginOf("an-2")).toBe("an.nguyen");
  });

  it("moves a member who already has a login, and drops the login left empty", async () => {
    expect((await create(["an-2", "an-3"])).error).toBeNull();
    expect(loginOf("an-3")).toBe("an.nguyen");
    expect(tables.accounts.some((a) => a.id === "old")).toBe(false);
  });

  it("refuses two members of one club, or one of the login's own club", async () => {
    expect((await create(["an-2", "cuong-2"])).error).toBe("Mỗi CLB chỉ gắn được một thành viên.");
    expect((await create(["binh-1"])).error).toBe("Có thành viên không gắn được. Tải lại trang rồi chọn lại.");
    expect(tables.accounts).toHaveLength(1);
  });

  it("refuses a member of a club the owner does not have", async () => {
    const state = await create(["an-9"]);
    expect(state.error).toBe("Có thành viên không gắn được. Tải lại trang rồi chọn lại.");
    expect(state.alsoLink).toEqual(["an-9"]);
  });
});
