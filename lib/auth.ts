import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// MVP: one admin account. ID and password live in Vercel environment variables, never in code (DN-1).
function sameText(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export function checkCredentials(id: string, password: string): boolean {
  const adminId = process.env.ADMIN_ID;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminId || !adminPassword) {
    throw new Error("ADMIN_ID and ADMIN_PASSWORD must be set");
  }
  const idOk = sameText(id, adminId);
  const passwordOk = sameText(password, adminPassword);
  return idOk && passwordOk;
}
