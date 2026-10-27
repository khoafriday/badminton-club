import { describe, expect, it } from "vitest";
import { parseCourt } from "./court-form";

describe("parseCourt", () => {
  it("trims the text and reads the price", () => {
    expect(parseCourt({ name: " Sân Tân Bình ", address: " 12 Cộng Hòa ", price: "120k", max_players: " 16 " })).toEqual({
      data: { name: "Sân Tân Bình", address: "12 Cộng Hòa", price: 120000, max_players: 16 },
    });
  });

  it("allows an empty address, price and max players", () => {
    expect(parseCourt({ name: "Sân A", address: "  ", price: "", max_players: "" })).toEqual({
      data: { name: "Sân A", address: null, price: 0, max_players: null },
    });
  });

  it("requires a name", () => {
    expect(parseCourt({ name: "  ", address: "", price: "100.000", max_players: "" })).toEqual({ error: "Nhập tên sân." });
  });

  it("rejects a price that is not a whole amount", () => {
    expect(parseCourt({ name: "Sân A", address: "", price: "một trăm", max_players: "" })).toEqual({
      error: "Giá chỉ gồm chữ số, ví dụ 100.000.",
    });
  });

  it("rejects a max players that is not a whole number above 0", () => {
    for (const max_players of ["0", "2.5", "mười"]) {
      expect(parseCourt({ name: "Sân A", address: "", price: "", max_players })).toEqual({
        error: "Số người tối đa là số nguyên lớn hơn 0.",
      });
    }
  });
});
