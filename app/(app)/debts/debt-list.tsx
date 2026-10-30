"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { setLinePaid } from "@/app/actions/attendance";
import { setFeePaid } from "@/app/actions/fees";
import { formatVnd } from "@/lib/billing";
import type { Debtor, DebtItem } from "@/lib/debts";
import { useLocale } from "@/app/ui/locale";
import { translator } from "@/lib/i18n";
import { feeMonthLabel, sessionDayLabel } from "@/lib/i18n/labels";

export function DebtList({ debtors }: { debtors: Debtor[] }) {
  const locale = useLocale();
  const t = translator(locale);
  // Paid items disappear at once; the server refresh then confirms it.
  const [paidIds, markPaid] = useOptimistic<string[], string>([], (ids, id) => [...ids, id]);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const visible = debtors
    .map((d) => {
      const items = d.items.filter((i) => !paidIds.includes(i.id));
      return { ...d, items, total: items.reduce((sum, i) => sum + i.amount, 0) };
    })
    .filter((d) => d.items.length > 0);
  const grandTotal = visible.reduce((sum, d) => sum + d.total, 0);

  function pay(item: DebtItem) {
    setError(null);
    startTransition(async () => {
      markPaid(item.id);
      const result =
        item.kind === "fee" ? await setFeePaid(item.id, true) : await setLinePaid(item.sessionId, item.id, true);
      if (result.error) setError(t(result.error));
    });
  }

  return (
    <>
      <section className="hero mx-5 mt-1 p-5">
        <p className="text-xs opacity-80">{t("Tổng còn nợ")}</p>
        <p className="mt-1 text-[32px] leading-tight font-extrabold tracking-tight">{formatVnd(grandTotal)}</p>
        <p className="mt-1 text-xs opacity-85">{t("{count} người", { count: visible.length })}</p>
      </section>
      {error && (
        <p role="alert" className="mx-5 mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {visible.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">{t("Không ai còn nợ.")}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3 px-5">
          {visible.map((d) => (
            <li key={d.memberId} className="card px-4 py-3">
              <div className="flex items-center justify-between">
                <Link href={`/members/${d.memberId}`} className="flex items-center gap-3 font-bold">
                  <span className="flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    {d.name.trim().charAt(0).toUpperCase()}
                  </span>
                  {d.name}
                </Link>
                <span className="font-bold text-red-600">{formatVnd(d.total)}</span>
              </div>
              <ul className="mt-2 divide-y divide-line">
                {d.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 py-2 text-sm">
                    <Link
                      href={i.kind === "fee" ? `/fees?month=${i.month}` : `/sessions/${i.sessionId}`}
                      className="flex-1 text-muted"
                    >
                      {i.kind === "fee" ? feeMonthLabel(i.month, locale) : sessionDayLabel(i.date, locale)}
                    </Link>
                    <span>{formatVnd(i.amount)}</span>
                    <button
                      onClick={() => pay(i)}
                      className="h-8 rounded-full border border-line-strong bg-surface px-3 text-xs font-bold text-ink"
                    >
                      {t("Đã nộp")}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
