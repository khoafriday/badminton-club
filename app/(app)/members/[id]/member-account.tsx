"use client";

import { useActionState } from "react";
import {
  createMemberAccount,
  deleteMemberAccount,
  resetMemberPassword,
  type AccountFormState,
} from "@/app/actions/member-accounts";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";
import type { MemberAccount } from "@/lib/member-accounts";

const EMPTY: AccountFormState = { error: null, saved: false, loginId: "" };

/** TK-1: the owner makes a member's login, gives a new password, or removes the login. */
export function MemberAccountPanel({ memberId, account }: { memberId: string; account: MemberAccount | null }) {
  if (!account) return <CreateAccount memberId={memberId} />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        ID <span className="font-bold">{account.loginId}</span>
        <span className="block text-xs text-muted">
          {account.passwordChanged ? "Thành viên đã đổi mật khẩu." : "Chưa đổi mật khẩu lần đầu."} Chỉ xem được Tổng
          quan, Lịch và Quỹ.
        </span>
      </p>
      <ResetPassword memberId={memberId} />
      <form
        action={deleteMemberAccount.bind(null, memberId)}
        onSubmit={(e) => {
          if (!confirm(`Xóa tài khoản "${account.loginId}"? Thành viên sẽ không đăng nhập được nữa.`))
            e.preventDefault();
        }}
      >
        <button className="h-11 w-full rounded-full border border-red-200 text-sm font-semibold text-red-600">
          Xóa tài khoản
        </button>
      </form>
    </div>
  );
}

function CreateAccount({ memberId }: { memberId: string }) {
  const [state, formAction, pending] = useActionState(createMemberAccount.bind(null, memberId), EMPTY);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        Thành viên đăng nhập bằng ID và mật khẩu này, rồi được hỏi có muốn đổi mật khẩu.
      </p>
      <label className={labelClass}>
        ID đăng nhập
        <input
          name="login_id"
          defaultValue={state.loginId}
          autoCapitalize="none"
          autoComplete="off"
          placeholder="Ví dụ: an.nguyen"
          required
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Mật khẩu lần đầu
        <input name="password" type="text" autoComplete="off" required className={inputClass} />
      </label>
      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error}
      </p>
      <button disabled={pending} className={primaryButtonClass}>
        {pending ? "Đang tạo..." : "Tạo tài khoản"}
      </button>
    </form>
  );
}

function ResetPassword({ memberId }: { memberId: string }) {
  const [state, formAction, pending] = useActionState(resetMemberPassword.bind(null, memberId), EMPTY);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label className={labelClass}>
        Đặt mật khẩu mới
        <input name="password" type="text" autoComplete="off" required className={inputClass} />
      </label>
      <p aria-live="polite" className={`min-h-5 text-sm ${state.error ? "text-red-600" : "text-brand-700"}`}>
        {state.error ?? (state.saved ? "Đã đặt mật khẩu mới. Thành viên sẽ được hỏi đổi lại." : "")}
      </p>
      <button disabled={pending} className="h-11 rounded-full border border-line-strong text-sm font-semibold">
        {pending ? "Đang lưu..." : "Đặt lại mật khẩu"}
      </button>
    </form>
  );
}
