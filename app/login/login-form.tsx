"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";

const initialState: LoginState = { error: null, id: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

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
        Mật khẩu
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </label>
      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error}
      </p>
      <button disabled={pending} className={primaryButtonClass}>
        {pending ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
