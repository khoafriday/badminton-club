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
  todayInVietnam: () => "2026-10-28",
}));

const { createMember } = await import("./members");

const empty = { full_name: "", gender: "", phone: "", member_type: "", status: "", fixed_since: "", note: "" };
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
