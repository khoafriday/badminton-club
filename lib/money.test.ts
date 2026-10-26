import { describe, expect, it } from "vitest";
import { formatVndTyping, parseVnd } from "./money";

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

describe("formatVndTyping", () => {
  it("groups digits as they are typed", () => {
    expect(formatVndTyping("3")).toBe("3");
    expect(formatVndTyping("3000")).toBe("3.000");
    expect(formatVndTyping("30.0000")).toBe("300.000");
    expect(formatVndTyping("1234567")).toBe("1.234.567");
  });

  it("keeps an empty box empty and drops leading zeros", () => {
    expect(formatVndTyping("")).toBe("");
    expect(formatVndTyping("0")).toBe("0");
    expect(formatVndTyping("05")).toBe("5");
  });

  it("turns a k suffix into thousands", () => {
    expect(formatVndTyping("45k")).toBe("45.000");
  });
});
