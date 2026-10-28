"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { checkCredentials } from "@/lib/auth";
import { findAccountLogin } from "@/lib/member-accounts";
import { createSession, deleteSession } from "@/lib/session";

const loginSchema = z.object({
  id: z.string().trim().min(1),
  password: z.string().min(1),
});

export type LoginState = { error: string | null; id: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const id = String(formData.get("id") ?? "");
  const parsed = loginSchema.safeParse({ id, password: formData.get("password") });
  if (!parsed.success) return { error: "Nhập ID và mật khẩu.", id };

  // React resets the form after an action, so the ID is sent back to refill the field.
  if (checkCredentials(parsed.data.id, parsed.data.password)) {
    await createSession({ kind: "admin", id: parsed.data.id });
    redirect("/");
  }
  // Otherwise a member's own login, shared by every club they play in (TK-2).
  const account = await findAccountLogin(parsed.data.id, parsed.data.password);
  if (!account) return { error: "Sai ID hoặc mật khẩu.", id };
  await createSession({ kind: "member", accountId: account.accountId });
  // Until the first password is changed, each login offers to change it.
  redirect(account.passwordChanged ? "/" : "/account?welcome=1");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
