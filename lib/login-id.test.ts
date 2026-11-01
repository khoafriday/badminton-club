import { describe, expect, it } from "vitest";
import { generatePassword, LOGIN_ID_PATTERN, loginIdBase, loginIdOptions, pickLoginId } from "./login-id";

describe("loginIdBase", () => {
  it("drops accents, đ, spaces and symbols", () => {
    expect(loginIdBase("Nguyễn Văn Đức")).toBe("nguyenvanduc");
    expect(loginIdBase("  Dũng Mập! ")).toBe("dungmap");
  });

  it("keeps room for xx in 30 characters", () => {
    const id = `${loginIdBase("a".repeat(40))}12`;
    expect(id.length).toBe(30);
    expect(id).toMatch(LOGIN_ID_PATTERN);
  });

  it("falls back when no letter is left", () => {
    expect(loginIdBase("!!!")).toBe("thanhvien");
  });
});

describe("pickLoginId", () => {
  it("is <base>xx with two digits", () => {
    expect(pickLoginId("an", new Set())).toMatch(/^an\d{2}$/);
  });

  it("skips IDs already taken", () => {
    const options = loginIdOptions("an");
    const taken = new Set(options.filter((id) => id !== "an37"));
    expect(pickLoginId("an", taken)).toBe("an37");
  });

  it("adds a third digit when all 100 are taken", () => {
    expect(pickLoginId("an", new Set(loginIdOptions("an")))).toMatch(/^an\d{3}$/);
  });
});

describe("generatePassword", () => {
  it("has 6 characters that are easy to read", () => {
    for (let i = 0; i < 50; i++) expect(generatePassword()).toMatch(/^[a-hj-km-np-z2-9]{6}$/);
  });
});
