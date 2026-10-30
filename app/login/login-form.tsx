"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";
import { Bi } from "@/app/ui/bi";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";
import { useShellT } from "@/app/ui/locale";

const initialState: LoginState = { error: null, id: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  // The login page is static, so its text cannot wait for the request (see app/ui/bi.tsx).
  const t = useShellT();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className={labelClass}>
        ID
        <input
          name="id"
          defaultValue={state.id}
          autoComplete="username"
          autoCapitalize="none"
          required
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        <Bi text="Mật khẩu" />
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </label>
      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error && t(state.error)}
      </p>
      <button disabled={pending} className={primaryButtonClass}>
        {pending ? t("Đang đăng nhập...") : <Bi text="Đăng nhập" />}
      </button>
    </form>
  );
}
