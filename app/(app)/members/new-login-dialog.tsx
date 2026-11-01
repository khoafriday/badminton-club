"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CreatedMember } from "@/app/actions/members";
import { primaryButtonClass } from "@/app/ui/form";
import { useT } from "@/app/ui/locale";

function CopyRow({ label, value }: { label: string; value: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line-strong bg-surface px-4 py-2.5">
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-semibold text-muted">{label}</span>
        <span className="truncate font-mono text-lg font-bold text-ink select-all">{value}</span>
      </div>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard
            ?.writeText(value)
            .then(() => setCopied(true))
            .catch(() => {})
        }
        className="h-9 shrink-0 rounded-full border border-line-strong px-3 text-xs font-semibold"
      >
        {t(copied ? "Đã chép" : "Chép")}
      </button>
    </div>
  );
}

/**
 * Shown once after Thêm thành viên: the login made for the new member. Only the hash is saved,
 * so this is the one time the password can be read; it can be set again in Cài đặt > Tài khoản thành viên.
 */
export function NewLoginDialog({ created }: { created: CreatedMember }) {
  const t = useT();
  const router = useRouter();
  const done = useRef<HTMLButtonElement>(null);
  useEffect(() => done.current?.focus(), []);
  const close = () => router.push("/members");
  const { account } = created;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      onKeyDown={(e) => e.key === "Escape" && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-login-title"
        className="flex w-full max-w-[440px] flex-col gap-4 rounded-3xl bg-page p-5 shadow-xl"
      >
        <div className="flex flex-col gap-1">
          <h2 id="new-login-title" className="text-xl font-bold">
            {t("Đã thêm {name}", { name: created.name })}
          </h2>
          <p className="text-sm text-muted">
            {account
              ? t("Đã tạo tài khoản đăng nhập. Gửi ID và mật khẩu này cho thành viên.")
              : t("Chưa tạo được tài khoản đăng nhập. Tạo lại trong Cài đặt.")}
          </p>
        </div>

        {account && (
          <>
            <div className="flex flex-col gap-2">
              <CopyRow label={t("ID đăng nhập")} value={account.loginId} />
              <CopyRow label={t("Mật khẩu")} value={account.password} />
            </div>
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">
              {t("Mật khẩu chỉ hiện lần này. Lần đầu đăng nhập, thành viên sẽ được hỏi đổi mật khẩu.")}
            </p>
          </>
        )}

        <Link
          href={
            account ? `/settings/accounts/${account.accountId}` : `/settings/accounts/new?member=${created.memberId}`
          }
          className="self-start text-sm font-semibold text-brand-700 underline underline-offset-2"
        >
          {t(account ? "Đổi ID hoặc mật khẩu" : "Tạo tài khoản")} ›
        </Link>

        <button ref={done} type="button" onClick={close} className={primaryButtonClass}>
          {t("Xong")}
        </button>
      </div>
    </div>
  );
}
