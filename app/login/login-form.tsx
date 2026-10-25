"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = { error: null, id: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        ID
        <input
          name="id"
          defaultValue={state.id}
          autoComplete="username"
          autoCapitalize="none"
          required
          className="h-12 rounded-lg border border-zinc-300 px-3 text-base outline-none focus:border-brand-600"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Mật khẩu
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 rounded-lg border border-zinc-300 px-3 text-base outline-none focus:border-brand-600"
        />
      </label>
      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error}
      </p>
      <button
        disabled={pending}
        className="h-12 rounded-lg bg-brand-600 font-semibold text-white active:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
