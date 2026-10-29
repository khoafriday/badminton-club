import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
beforeAll(() => {
  process.env.SESSION_SECRET = "x".repeat(32);
});
const { signSession, verifySession, MEMBER_PATHS } = await import("./session-token");
const { hashPassword, verifyPassword } = await import("./password");

describe("login cookie", () => {
  it("keeps who is signed in: the admin or a member", async () => {
    expect(await verifySession(await signSession({ kind: "admin", id: "khoatran" }))).toEqual({
      kind: "admin",
      id: "khoatran",
    });
    expect(await verifySession(await signSession({ kind: "member", accountId: "acc-1" }))).toEqual({
      kind: "member",
      accountId: "acc-1",
    });
  });

  it("rejects a forged token", async () => {
    expect(await verifySession("abc.def.ghi")).toBeNull();
  });

  it("lets a member open only Tổng quan, Lịch, Quỹ and their account", () => {
    expect(MEMBER_PATHS).toEqual(["/", "/schedule", "/fund", "/pay", "/history", "/account", "/logout"]);
  });
});

describe("member passwords", () => {
  it("checks the password against the stored hash, never the plain text", async () => {
    const stored = await hashPassword("cau-long-123");
    expect(stored).not.toContain("cau-long-123");
    expect(await verifyPassword("cau-long-123", stored)).toBe(true);
    expect(await verifyPassword("sai", stored)).toBe(false);
  });
});
