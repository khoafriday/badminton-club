"use client";

import { useActionState } from "react";
import { changeOwnPassword } from "@/app/actions/member-accounts";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";
import { useT } from "@/app/ui/locale";

export function ChangePasswordForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState(changeOwnPassword, { error: null });
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className={labelClass}>
        {t("Mật khẩu mới")}
        <input name="password" type="password" autoComplete="new-password" required className={inputClass} />
      </label>
      <label className={labelClass}>
        {t("Nhập lại mật khẩu mới")}
        <input name="confirm" type="password" autoComplete="new-password" required className={inputClass} />
      </label>
      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error && t(state.error)}
      </p>
      <button disabled={pending} className={primaryButtonClass}>
        {t(pending ? "Đang lưu..." : "Đổi mật khẩu")}
      </button>
    </form>
  );
}
