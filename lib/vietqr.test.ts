import { describe, expect, it } from "vitest";
import { TPBANK_BIN, crc16, findPaymentCodes, newPaymentCode, vietQrPayload } from "./vietqr";

/** Reads EMVCo id-length-value text back into a map. */
function tlv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < text.length; ) {
    const id = text.slice(i, i + 2);
    const len = Number(text.slice(i + 2, i + 4));
    out[id] = text.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

describe("crc16", () => {
  it("is CRC-16/CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
});

describe("vietQrPayload", () => {
  const payload = vietQrPayload({ bin: TPBANK_BIN, accountNo: "00012345678", amount: 550000, note: "BC7K2QX9" });

  it("holds the bank, account, amount and note", () => {
    const top = tlv(payload);
    expect(top["00"]).toBe("01");
    expect(top["01"]).toBe("12");
    expect(top["53"]).toBe("704");
    expect(top["54"]).toBe("550000");
    expect(top["58"]).toBe("VN");
    expect(tlv(top["62"])["08"]).toBe("BC7K2QX9");
    const merchant = tlv(top["38"]);
    expect(merchant["00"]).toBe("A000000727");
    expect(merchant["02"]).toBe("QRIBFTTA");
    expect(tlv(merchant["01"])).toEqual({ "00": "970423", "01": "00012345678" });
  });

  it("ends with the checksum of everything before it", () => {
    expect(payload.slice(-8, -4)).toBe("6304");
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });
});

describe("payment codes", () => {
  it("makes BC and six letters or digits without 0, O, 1 or I", () => {
    for (let i = 0; i < 50; i++) expect(newPaymentCode()).toMatch(/^BC[A-HJ-NP-Z2-9]{6}$/);
    expect(newPaymentCode(() => new Uint8Array([0, 31, 32, 255, 1, 2]))).toBe("BCA9A9BC");
  });

  it("finds the code in notes the bank has changed", () => {
    expect(findPaymentCodes("BC7K2QX9")).toEqual(["BC7K2QX9"]);
    expect(findPaymentCodes("MBVCB.123456.bc7k2qx9.CT tu 0123 NGUYEN VAN A")).toContain("BC7K2QX9");
    expect(findPaymentCodes("BC7K-2QX9 chuyen tien")).toContain("BC7K2QX9");
    // Overlapping: the letters before the code look like a code too.
    expect(findPaymentCodes("ABCBC7K2QX9")).toContain("BC7K2QX9");
    expect(findPaymentCodes("tien an trua")).toEqual([]);
  });
});
