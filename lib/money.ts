import { formatVnd } from "./billing";

/** Reads a VND amount typed by hand: "300.000", "300000" or "300k". Null when it is not a whole amount. */
export function parseVnd(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/đ$/, "").trim();
  if (text === "") return 0;
  const thousands = text.endsWith("k");
  const digits = (thousands ? text.slice(0, -1) : text).replace(/[.,\s]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const amount = Number(digits) * (thousands ? 1000 : 1);
  return Number.isSafeInteger(amount) ? amount : null;
}

/** An amount as it goes back into a form field: 300000 → "300.000", which parseVnd reads back. */
export function formatVndInput(amount: number): string {
  return formatVnd(amount).replace("đ", "");
}
