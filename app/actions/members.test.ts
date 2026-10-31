import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Tables } from "@/lib/testing/fake-db";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("REDIRECT");
  },
}));
let tables: Tables;
vi.mock("@/lib/supabase", () => ({ db: () => fakeDb(tables) }));
vi.mock("@/lib/club", () => ({
  requireClub: async () => ({ userId: "khoa", club: { id: "club-1" } }),
  listClubs: async () => [{ id: "club-1" }, { id: "club-2" }],
  todayInVietnam: () => "2026-10-28",
}));

const { createMember } = await import("./members");

const empty = { full_name: "", nickname: "", gender: "", phone: "", member_type: "", status: "", fixed_since: "", note: "" };
function add(name: string) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ full_name: name, gender: "male", member_type: "fixed", fixed_since: "2026-10-01" })) {
    fd.append(k, v);
  }
  return createMember({ error: null, values: empty }, fd).catch((e: Error) => e.message);
}

beforeEach(() => {
  tables = {
    members: [
      { id: "an", club_id: "club-1", full_name: "Nguyễn Văn An", member_type: "fixed" },
      { id: "binh", club_id: "club-1", full_name: "Bình", member_type: "guest" },
      { id: "cuong", club_id: "club-2", full_name: "Cường", member_type: "fixed" },
    ],
  };
});

describe("two fixed members with the same name", () => {
  it("refuses the same name in the club, whatever the case and spaces", async () => {
    expect(await add("  nguyễn   văn AN ")).toMatchObject({
      error: "CLB đã có thành viên cố định tên này. Đặt tên khác, ví dụ thêm họ hoặc số.",
    });
  });

  it("allows a name used only by a guest, or in another club", async () => {
    expect(await add("Bình")).toBe("REDIRECT");
    expect(await add("Cường")).toBe("REDIRECT");
  });
});

describe("adding someone already in the app", () => {
  function pick(id: string, fixed_since = "2026-10-01") {
    const fd = new FormData();
    fd.append("source_member_id", id);
    fd.append("fixed_since", fixed_since);
    return createMember({ error: null, values: empty }, fd).catch((e: Error) => e.message);
  }

  beforeEach(() => {
    tables.members.push({
      id: "dung",
      club_id: "club-2",
      full_name: "Dũng",
      nickname: "Dũng Mập",
      gender: "male",
      phone: "0901",
      member_type: "fixed",
      status: "active",
    });
    tables.account_members = [{ member_id: "dung", account_id: "acc-dung" }];
  });

  it("copies a member of another club and links the same login", async () => {
    expect(await pick("dung")).toBe("REDIRECT");
    const copy = tables.members.find((m) => m.club_id === "club-1" && m.full_name === "Dũng");
    expect(copy).toMatchObject({ nickname: "Dũng Mập", phone: "0901", member_type: "fixed", fixed_since: "2026-10-01" });
    expect(tables.account_members).toContainEqual({ id: expect.any(String), member_id: copy?.id, account_id: "acc-dung" });
  });

  it("turns a guest of this club into a fixed member on the same row", async () => {
    expect(await pick("binh")).toBe("REDIRECT");
    expect(tables.members.find((m) => m.id === "binh")).toMatchObject({ member_type: "fixed", status: "active" });
    expect(tables.members.filter((m) => m.full_name === "Bình")).toHaveLength(1);
  });

  it("refuses a name a fixed member here already has", async () => {
    tables.members.push({ id: "dung-here", club_id: "club-1", full_name: "dũng", member_type: "fixed" });
    expect(await pick("dung")).toMatchObject({ error: expect.stringContaining("CLB đã có") });
  });

  it("needs the fixed-since day", async () => {
    expect(await pick("dung", "")).toMatchObject({ error: "Chọn ngày bắt đầu cố định." });
  });
});
