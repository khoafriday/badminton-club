"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createMemberAccount,
  linkExistingAccount,
  resetMemberPassword,
  unlinkMemberAccount,
  type AccountFormState,
} from "@/app/actions/member-accounts";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";
import { useT } from "@/app/ui/locale";
import type { LinkCandidate } from "@/lib/account-links";
import type { MemberAccount } from "@/lib/member-accounts";
import { foldText } from "@/lib/member-filter";

const EMPTY: AccountFormState = { error: null, saved: false, loginId: "" };

/** TK-1, TK-5: the owner makes a member's login or links one they already have, gives a new password, or removes it. */
export function MemberAccountPanel({
  memberId,
  account,
  candidates,
}: {
  memberId: string;
  account: MemberAccount | null;
  candidates: LinkCandidate[];
}) {
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
        {linking ? <LinkAccount memberId={memberId} /> : <CreateAccount memberId={memberId} candidates={candidates} />}
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

function CreateAccount({ memberId, candidates }: { memberId: string; candidates: LinkCandidate[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(createMemberAccount.bind(null, memberId), EMPTY);
  const [picked, setPicked] = useState<string[]>(state.alsoLink ?? []);
  const moving = candidates.filter((c) => picked.includes(c.memberId) && c.loginId);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (moving.length === 0) return;
        const list = moving.map((c) => `${c.name} (${c.clubName}): ${c.loginId}`).join("\n");
        if (!confirm(t("Các thành viên này đang có tài khoản khác và sẽ chuyển sang ID mới:\n{list}", { list })))
          e.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
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
      {candidates.length > 0 && <AlsoLink candidates={candidates} picked={picked} onChange={setPicked} />}
      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error && t(state.error)}
      </p>
      <button disabled={pending} className={primaryButtonClass}>
        {t(pending ? "Đang tạo..." : "Tạo tài khoản")}
      </button>
    </form>
  );
}

/** TK-6: the person's member rows in the owner's other clubs, one per club, to open with the same login. */
function AlsoLink({
  candidates,
  picked,
  onChange,
}: {
  candidates: LinkCandidate[];
  picked: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const term = foldText(q.trim());
    return term ? candidates.filter((c) => foldText(c.name).includes(term)) : candidates;
  }, [candidates, q]);
  const pickedClubs = new Set(candidates.filter((c) => picked.includes(c.memberId)).map((c) => c.clubId));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold text-muted">
        {t("Gắn thêm cho thành viên ở CLB khác")}
        {picked.length > 0 && ` (${picked.length})`}
      </legend>
      <p className="text-xs text-muted">
        {t("Cùng một người chơi nhiều CLB thì dùng chung 1 ID. Mỗi CLB chọn 1 thành viên.")}
      </p>
      {candidates.length > 5 && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Tìm theo tên")}
          className={inputClass}
        />
      )}
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
        {/* Picked members stay in the form while the search hides them. */}
        {candidates
          .filter((c) => picked.includes(c.memberId) && !shown.includes(c))
          .map((c) => (
            <input key={c.memberId} type="hidden" name="also_link" value={c.memberId} />
          ))}
        {shown.map((c) => {
          const checked = picked.includes(c.memberId);
          const blocked = !checked && pickedClubs.has(c.clubId);
          return (
            <label
              key={c.memberId}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-line-strong bg-surface px-4 py-2 text-sm has-checked:border-cta ${blocked ? "opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                name="also_link"
                value={c.memberId}
                checked={checked}
                disabled={blocked}
                onChange={(e) =>
                  onChange(e.target.checked ? [...picked, c.memberId] : picked.filter((id) => id !== c.memberId))
                }
                className="size-4 accent-brand-600"
              />
              <span className="flex flex-1 flex-col">
                <span className="font-semibold text-ink">{c.name}</span>
                <span className="text-xs text-muted">{c.clubName}</span>
                {c.loginId && (
                  <span className="text-xs font-semibold text-amber-700">
                    {t("Đã có tài khoản: {id}. Chọn thì chuyển sang ID mới.", { id: c.loginId })}
                  </span>
                )}
              </span>
            </label>
          );
        })}
        {shown.length === 0 && <p className="text-sm text-muted">{t("Không có thành viên nào khớp.")}</p>}
      </div>
    </fieldset>
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
