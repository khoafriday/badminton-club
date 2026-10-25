import { describe, expect, it } from "vitest";
import { parseMember, type MemberFormValues } from "./members";

const base: MemberFormValues = {
  full_name: "  Anh Tuấn ",
  gender: "male",
  phone: "",
  member_type: "fixed",
  status: "active",
  fixed_since: "2026-10-01",
  note: "",
};

describe("parseMember", () => {
  it("trims the name and turns empty optional fields into null", () => {
    expect(parseMember(base)).toEqual({
      data: { ...base, full_name: "Anh Tuấn", phone: null, note: null },
    });
  });

  it("requires a name", () => {
    expect(parseMember({ ...base, full_name: "   " })).toEqual({ error: "Nhập tên." });
  });

  it("requires the fixed-since date for a fixed member", () => {
    expect(parseMember({ ...base, fixed_since: "" })).toEqual({ error: "Chọn ngày bắt đầu cố định." });
  });

  it("drops the fixed-since date for a guest", () => {
    const result = parseMember({ ...base, member_type: "guest" });
    expect(result).toMatchObject({ data: { member_type: "guest", fixed_since: null } });
  });

  it("rejects letters in the phone number", () => {
    expect(parseMember({ ...base, phone: "09abc" })).toEqual({ error: "Số điện thoại chỉ gồm chữ số." });
  });

  it("rejects an unknown gender", () => {
    expect(parseMember({ ...base, gender: "" })).toEqual({ error: "Chọn Nam hoặc Nữ." });
  });
});
