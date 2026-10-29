"use client";

import { useActionState, useState } from "react";
import {
  createMemberAccount,
  linkExistingAccount,
  resetMemberPassword,
  unlinkMemberAccount,
  type AccountFormState,
} from "@/app/actions/member-accounts";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";
import { useT } from "@/app/ui/locale";
import type { MemberAccount } from "@/lib/member-accounts";

const EMPTY: AccountFormState = { error: null, saved: false, loginId: "" };

/** TK-1, TK-5: the owner makes a member's login or links one they already have, gives a new password, or removes it. */
export function MemberAccountPanel({ memberId, account }: { memberId: string; account: MemberAccount | null }) {
  const t = useT();
  const [linking, setLinking] = useState(false);
  if (!account) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex rounded-full bg-surface-2 p-1 text-sm font-semibold">
          {[
            { key: false, label: "Tạo tài khoản mới" },
            { key: true, label: "Gắn tài khoản có sẵn" },
          ].map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setLinking(tab.key)}
              className={`flex-1 rounded-full py-2 ${tab.key === linking ? "bg-surface text-ink shadow-card" : "text-muted"}`}
            >
              {t(tab.label)}
            </button>
          ))}
        </div>
        {linking ? <LinkAccount memberId={memberId} /> : <CreateAccount memberId={memberId} />}
      </div>
    );
  }
  const shared = account.linkCount > 1;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        ID <span className="font-bold">{account.loginId}</span>
        <span className="block text-xs text-muted">
          {t(account.passwordChanged ? "Thành viên đã đổi mật khẩu." : "Chưa đổi mật khẩu lần đầu.")}{" "}
          {shared ? `${t("Dùng chung cho {count} CLB.", { count: account.linkCount })} ` : ""}
          {t("Chỉ xem được Tổng quan, Lịch và Quỹ.")}
        </span>
      </p>
      <ResetPassword memberId={memberId} />
      <form
        action={unlinkMemberAccount.bind(null, memberId)}
        onSubmit={(e) => {
          const message = t(
            shared
              ? 'Gỡ tài khoản "{id}" khỏi CLB này? Các CLB khác vẫn dùng được.'
              : 'Xóa tài khoản "{id}"? Thành viên sẽ không đăng nhập được nữa.',
            { id: account.loginId },
          );
          if (!confirm(message)) e.preventDefault();
        }}
      >
        <button className="h-11 w-full rounded-full border border-red-200 text-sm font-semibold text-red-600">
          {t(shared ? "Gỡ khỏi CLB này" : "Xóa tài khoản")}
        </button>
      </form>
    </div>
  );
}

function CreateAccount({ memberId }: { memberId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(createMemberAccount.bind(null, memberId), EMPTY);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        {t("Thành viên đăng nhập bằng ID và mật khẩu này, rồi được hỏi có muốn đổi mật khẩu.")}
      </p>
      <label className={labelClass}>
        {t("ID đăng nhập")}
        <input
          name="login_id"
          defaultValue={state.loginId}
          autoCapitalize="none"
          autoComplete="off"
          placeholder={t("Ví dụ: an.nguyen")}
          required
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        {t("Mật khẩu lần đầu")}
        <input name="password" type="text" autoComplete="off" required className={inputClass} />
      </label>
      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error && t(state.error)}
      </p>
      <button disabled={pending} className={primaryButtonClass}>
        {t(pending ? "Đang tạo..." : "Tạo tài khoản")}
      </button>
    </form>
  );
}

function ResetPassword({ memberId }: { memberId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(resetMemberPassword.bind(null, memberId), EMPTY);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label className={labelClass}>
        {t("Đặt mật khẩu mới")}
        <input name="password" type="text" autoComplete="off" required className={inputClass} />
      </label>
      <p aria-live="polite" className={`min-h-5 text-sm ${state.error ? "text-red-600" : "text-brand-700"}`}>
        {state.error
          ? t(state.error)
          : state.saved
            ? t("Đã đặt mật khẩu mới cho mọi CLB của ID này. Thành viên sẽ được hỏi đổi lại.")
            : ""}
      </p>
      <button disabled={pending} className="h-11 rounded-full border border-line-strong text-sm font-semibold">
        {t(pending ? "Đang lưu..." : "Đặt lại mật khẩu")}
      </button>
    </form>
  );
}

function LinkAccount({ memberId }: { memberId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(linkExistingAccount.bind(null, memberId), EMPTY);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        {t("Người này đã có tài khoản ở CLB khác. Nhập ID đó: họ dùng ID và mật khẩu cũ, thấy thêm CLB này.")}
      </p>
      <label className={labelClass}>
        {t("ID đã có")}
        <input
          name="login_id"
          defaultValue={state.loginId}
          autoCapitalize="none"
          autoComplete="off"
          required
          className={inputClass}
        />
      </label>
      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error && t(state.error)}
      </p>
      <button disabled={pending} className={primaryButtonClass}>
        {t(pending ? "Đang gắn..." : "Gắn tài khoản")}
      </button>
    </form>
  );
}
