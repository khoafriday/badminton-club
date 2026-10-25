"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { setLinePaid } from "@/app/actions/attendance";
import { setFeePaid } from "@/app/actions/fees";
import { formatVnd } from "@/lib/billing";
import type { Debtor, DebtItem } from "@/lib/debts";
import { formatDayLabel, formatMonthLabel } from "@/lib/dates";

export function DebtList({ debtors }: { debtors: Debtor[] }) {
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
      if (result.error) setError(result.error);
    });
  }

  return (
    <>
      <section className="mx-5 mt-4 rounded-xl bg-amber-50 p-4 text-amber-900">
        <p className="text-sm">Tổng còn nợ · {visible.length} người</p>
        <p className="text-2xl font-bold">{formatVnd(grandTotal)}</p>
      </section>
      {error && (
        <p role="alert" className="mx-5 mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {visible.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-zinc-500">Không ai còn nợ.</p>
      ) : (
        <ul className="mt-2">
          {visible.map((d) => (
            <li key={d.memberId} className="border-b border-zinc-100 px-5 py-3">
              <div className="flex items-center justify-between">
                <Link href={`/members/${d.memberId}`} className="font-semibold">
                  {d.name}
                </Link>
                <span className="font-bold text-amber-600">{formatVnd(d.total)}</span>
              </div>
              <ul className="mt-1">
                {d.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 py-1 text-sm">
                    <Link
                      href={i.kind === "fee" ? `/fees?month=${i.month}` : `/sessions/${i.sessionId}`}
                      className="flex-1 text-zinc-600"
                    >
                      {i.kind === "fee"
                        ? `Phí ${formatMonthLabel(i.month).toLowerCase()}`
                        : `Buổi ${formatDayLabel(i.date)}`}
                    </Link>
                    <span>{formatVnd(i.amount)}</span>
                    <button
                      onClick={() => pay(i)}
                      className="h-8 rounded-full border border-zinc-300 px-3 text-xs font-semibold text-zinc-700"
                    >
                      Đã nộp
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
