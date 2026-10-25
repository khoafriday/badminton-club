import { describe, expect, it } from "vitest";
import { parseCourt } from "./court-form";

describe("parseCourt", () => {
  it("trims the text and reads the price", () => {
    expect(parseCourt({ name: " Sân Tân Bình ", address: " 12 Cộng Hòa ", price: "120k" })).toEqual({
      data: { name: "Sân Tân Bình", address: "12 Cộng Hòa", price: 120000 },
    });
  });

  it("allows an empty address and price", () => {
    expect(parseCourt({ name: "Sân A", address: "  ", price: "" })).toEqual({
      data: { name: "Sân A", address: null, price: 0 },
    });
  });

  it("requires a name", () => {
    expect(parseCourt({ name: "  ", address: "", price: "100.000" })).toEqual({ error: "Nhập tên sân." });
  });

  it("rejects a price that is not a whole amount", () => {
    expect(parseCourt({ name: "Sân A", address: "", price: "một trăm" })).toEqual({
      error: "Giá chỉ gồm chữ số, ví dụ 100.000.",
    });
  });
});
