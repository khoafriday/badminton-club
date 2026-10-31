"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  createAccount,
  deleteAccount,
  linkAccountMembers,
  resetAccountPassword,
  unlinkAccountMember,
  type AccountFormState,
} from "@/app/actions/member-accounts";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";
import { useT } from "@/app/ui/locale";
import type { LinkCandidate } from "@/lib/account-links";
import { foldText } from "@/lib/member-filter";

const EMPTY: AccountFormState = { error: null, saved: false, loginId: "" };

/** Asks before moving members who have another login: their old login loses them. */
function confirmMoves(t: ReturnType<typeof useT>, candidates: LinkCandidate[], picked: string[]): boolean {
  const moving = candidates.filter((c) => picked.includes(c.memberId) && c.loginId);
  if (moving.length === 0) return true;
  const list = moving.map((c) => `${c.name} (${c.clubName}): ${c.loginId}`).join("\n");
  return confirm(t("Các thành viên này đang có tài khoản khác và sẽ chuyển sang ID mới:\n{list}", { list }));
}

/** TK-6: one or more members, one per club, searchable by name. Members with another login show it as a warning. */
function MemberPicker({
  candidates,
  picked,
  onChange,
  takenClubIds = [],
}: {
  candidates: LinkCandidate[];
  picked: string[];
  onChange: (ids: string[]) => void;
  /** Clubs the login already opens: their members cannot be picked. */
  takenClubIds?: string[];
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const term = foldText(q.trim());
    return term
      ? candidates.filter((c) => foldText(c.name).includes(term) || foldText(c.loginId ?? "").includes(term))
      : candidates;
  }, [candidates, q]);
  const pickedClubs = new Set(candidates.filter((c) => picked.includes(c.memberId)).map((c) => c.clubId));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold text-muted">
        {t("Thành viên")}
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
      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {/* Picked members stay in the form while the search hides them. */}
        {candidates
          .filter((c) => picked.includes(c.memberId) && !shown.includes(c))
          .map((c) => (
            <input key={c.memberId} type="hidden" name="member" value={c.memberId} />
          ))}
        {shown.map((c) => {
          const checked = picked.includes(c.memberId);
          const blocked = !checked && (pickedClubs.has(c.clubId) || takenClubIds.includes(c.clubId));
          return (
            <label
              key={c.memberId}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-line-strong bg-surface px-4 py-2 text-sm has-checked:border-cta ${blocked ? "opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                name="member"
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

export function CreateAccountForm({ candidates, preselect }: { candidates: LinkCandidate[]; preselect: string[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(createAccount, EMPTY);
  const [picked, setPicked] = useState<string[]>(state.members ?? preselect);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirmMoves(t, candidates, picked)) e.preventDefault();
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
      <MemberPicker candidates={candidates} picked={picked} onChange={setPicked} />
      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error && t(state.error)}
      </p>
      <button disabled={pending || picked.length === 0} className={primaryButtonClass}>
        {t(pending ? "Đang tạo..." : "Tạo tài khoản")}
      </button>
    </form>
  );
}

export function LinkMembersForm({
  accountId,
  candidates,
  takenClubIds,
}: {
  accountId: string;
  candidates: LinkCandidate[];
  takenClubIds: string[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(linkAccountMembers.bind(null, accountId), EMPTY);
  const [chosen, setPicked] = useState<string[]>([]);
  // Members just linked leave the list, so they drop out of the picks too.
  const picked = chosen.filter((id) => candidates.some((c) => c.memberId === id));
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirmMoves(t, candidates, picked)) e.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      <MemberPicker candidates={candidates} picked={picked} onChange={setPicked} takenClubIds={takenClubIds} />
      <p aria-live="polite" className={`min-h-5 text-sm ${state.error ? "text-red-600" : "text-brand-700"}`}>
        {state.error ? t(state.error) : state.saved ? t("Đã gắn thêm thành viên.") : ""}
      </p>
      <button disabled={pending || picked.length === 0} className={primaryButtonClass}>
        {t(pending ? "Đang gắn..." : "Gắn thành viên")}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ accountId }: { accountId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(resetAccountPassword.bind(null, accountId), EMPTY);
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

export function UnlinkMemberButton({
  accountId,
  memberId,
  name,
  last,
}: {
  accountId: string;
  memberId: string;
  name: string;
  /** The login's only member: taking them off deletes the login. */
  last: boolean;
}) {
  const t = useT();
  return (
    <form
      action={unlinkAccountMember.bind(null, accountId, memberId)}
      onSubmit={(e) => {
        const message = t(
          last
            ? 'Gỡ "{name}"? Đây là thành viên cuối cùng nên tài khoản sẽ bị xóa.'
            : 'Gỡ "{name}" khỏi tài khoản này? Người này không vào CLB đó bằng ID này nữa.',
          { name },
        );
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <button className="h-9 rounded-full border border-red-200 px-3 text-xs font-semibold text-red-600">
        {t("Gỡ")}
      </button>
    </form>
  );
}

export function DeleteAccountButton({ accountId, loginId }: { accountId: string; loginId: string }) {
  const t = useT();
  return (
    <form
      action={deleteAccount.bind(null, accountId)}
      onSubmit={(e) => {
        if (!confirm(t('Xóa tài khoản "{id}"? Thành viên sẽ không đăng nhập được nữa.', { id: loginId })))
          e.preventDefault();
      }}
    >
      <button className="h-11 w-full rounded-full border border-red-200 text-sm font-semibold text-red-600">
        {t("Xóa tài khoản")}
      </button>
    </form>
  );
}

export type AccountListItem = {
  id: string;
  loginId: string;
  passwordChanged: boolean;
  lastLogin: string | null;
  members: { name: string; clubName: string }[];
};

/** Cài đặt > Tài khoản: every login, searchable by ID or member name. */
export function AccountList({
  accounts,
  without,
}: {
  accounts: AccountListItem[];
  without: { memberId: string; name: string; clubName: string }[];
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const term = foldText(q.trim());
  const match = (text: string) => !term || foldText(text).includes(term);
  const shown = accounts.filter((a) => match(a.loginId) || a.members.some((m) => match(m.name)));
  const shownWithout = without.filter((m) => match(m.name));
  return (
    <div className="flex flex-col gap-4">
      {(accounts.length > 5 || without.length > 5) && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Tìm theo ID hoặc tên")}
          className={inputClass}
        />
      )}
      <section className="flex flex-col gap-2">
        <h2 className="section-title">
          {t("Tài khoản")} ({accounts.length})
        </h2>
        {shown.length === 0 && (
          <p className="text-sm text-muted">{t(accounts.length === 0 ? "Chưa có tài khoản nào." : "Không có tài khoản nào khớp.")}</p>
        )}
        <ul className="flex flex-col gap-2">
          {shown.map((a) => (
            <li key={a.id}>
              <Link href={`/settings/accounts/${a.id}`} className="card flex flex-col gap-1 p-4">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-bold">{a.loginId}</span>
                  {!a.passwordChanged && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-muted">
                      {t("Chưa đổi mật khẩu")}
                    </span>
                  )}
                </span>
                <span className="text-sm text-ink">
                  {a.members.map((m) => `${m.name} (${m.clubName})`).join(", ")}
                </span>
                <span className="text-xs text-muted">
                  {a.lastLogin ? t("Đăng nhập gần nhất: {time}", { time: a.lastLogin }) : t("Chưa đăng nhập")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {without.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="section-title">
            {t("Thành viên chưa có tài khoản")} ({without.length})
          </h2>
          <ul className="card flex flex-col divide-y divide-line">
            {shownWithout.map((m) => (
              <li key={m.memberId} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block font-semibold">{m.name}</span>
                  <span className="block text-xs text-muted">{m.clubName}</span>
                </span>
                <Link
                  href={`/settings/accounts/new?member=${m.memberId}`}
                  className="h-9 shrink-0 rounded-full bg-surface-2 px-3 text-xs leading-9 font-bold text-ink"
                >
                  + {t("Tạo tài khoản")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
