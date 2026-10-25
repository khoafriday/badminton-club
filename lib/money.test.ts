import { describe, expect, it } from "vitest";
import { parseVnd } from "./money";

describe("parseVnd", () => {
  it("reads amounts with dot separators, a đ sign or a k suffix", () => {
    expect(parseVnd("300.000")).toBe(300000);
    expect(parseVnd("50000đ")).toBe(50000);
    expect(parseVnd("45k")).toBe(45000);
    expect(parseVnd(" 1,200,000 ")).toBe(1200000);
  });

  it("treats an empty box as zero", () => {
    expect(parseVnd("")).toBe(0);
  });

  it("rejects text and negative numbers", () => {
    expect(parseVnd("abc")).toBeNull();
    expect(parseVnd("-5000")).toBeNull();
  });
});
