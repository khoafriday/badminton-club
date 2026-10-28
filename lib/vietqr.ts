// VietQR (NAPAS, EMVCo) text for a transfer with a fixed amount and note. Any Vietnamese banking app reads it.
// Free of database code so it can be tested on its own.

/** TPBank's NAPAS bank id. */
export const TPBANK_BIN = "970423";

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** CRC-16/CCITT-FALSE, the checksum EMVCo puts at the end of the text. */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type VietQrInput = { bin: string; accountNo: string; amount: number; note: string };

export function vietQrPayload({ bin, accountNo, amount, note }: VietQrInput): string {
  const account = field("00", "A000000727") + field("01", field("00", bin) + field("01", accountNo)) + field("02", "QRIBFTTA");
  const body =
    field("00", "01") +
    field("01", "12") + // 12: made for one payment, with an amount
    field("38", account) +
    field("53", "704") + // VND
    field("54", String(Math.round(amount))) +
    field("58", "VN") +
    field("62", field("08", note)) +
    "6304";
  return body + crc16(body);
}

// Codes look like BC7K2QX9: no 0/O or 1/I, so they read back the same when typed by hand.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_PREFIX = "BC";
const CODE_LENGTH = 6;

export function newPaymentCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  // 256 is a multiple of 32, so every letter is equally likely.
  return CODE_PREFIX + [...random(CODE_LENGTH)].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/**
 * Codes found in a transfer note. Banks add their own words, change case and may drop or add spaces and dashes,
 * so the note is uppercased and stripped to letters and digits before looking.
 */
export function findPaymentCodes(content: string): string[] {
  const flat = content.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // A lookahead finds overlapping hits too: in "ABCBC7K2QX9" both BCBC7K2Q and BC7K2QX9 are tried.
  const pattern = new RegExp(`(?=(${CODE_PREFIX}[${CODE_ALPHABET}]{${CODE_LENGTH}}))`, "g");
  return [...new Set([...flat.matchAll(pattern)].map((m) => m[1]))];
}
