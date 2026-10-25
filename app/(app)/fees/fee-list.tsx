"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { setFeePaid, setFeeWaived, type FeeResult } from "@/app/actions/fees";
import { formatVnd, type FeeStatus } from "@/lib/billing";

export type FeeItem = {
  id: string;
  memberId: string;
  name: string;
  billingMode: "monthly" | "per_session";
  amountDue: number;
  status: FeeStatus;
  waiveReason: string | null;
};

const WAIVE_LABEL: Record<string, string> = { full_month_absence: "Nghỉ cả tháng", manual: "Miễn" };

/** TT-4 for a month: slips that are Miễn or charged per session are left out of the totals. */
function totals(items: FeeItem[]) {
  let due = 0;
  let paid = 0;
  for (const f of items) {
    if (f.billingMode !== "monthly" || f.status === "waived") continue;
    due += f.amountDue;
    if (f.status === "paid") paid += f.amountDue;
  }
  return { due, paid, outstanding: due - paid };
}

export function FeeList({ items }: { items: FeeItem[] }) {
  const [list, setStatus] = useOptimistic(items, (current, change: { id: string; status: FeeStatus }) =>
    current.map((f) => (f.id === change.id ? { ...f, status: change.status } : f)),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(id: string, status: FeeStatus, action: () => Promise<FeeResult>) {
    setError(null);
    startTransition(async () => {
      setStatus({ id, status });
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  const t = totals(list);
  return (
    <>
      <section className="mx-5 mt-4 grid grid-cols-3 rounded-xl border border-zinc-200 p-3 text-center">
        <div>
          <p className="text-xs text-zinc-500">Phải thu</p>
          <p className="font-bold">{formatVnd(t.due)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Đã thu</p>
          <p className="font-bold">{formatVnd(t.paid)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Còn nợ</p>
          <p className={`font-bold ${t.outstanding > 0 ? "text-amber-600" : ""}`}>{formatVnd(t.outstanding)}</p>
        </div>
      </section>
      {error && (
        <p role="alert" className="mx-5 mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {list.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-zinc-500">Không có phiếu phí tháng nào trong tháng này.</p>
      ) : (
        <ul className="mx-5 mt-3 divide-y divide-zinc-100">
          {list.map((f) => (
            <li key={f.id} className="flex min-h-16 items-center gap-3 py-2">
              <Link href={`/members/${f.memberId}`} className="min-w-0 flex-1">
                <p className="truncate font-medium">{f.name}</p>
                <p className="text-xs text-zinc-500">
                  {f.billingMode === "per_session"
                    ? "Vào giữa tháng, tính theo buổi"
                    : f.status === "waived"
                      ? `${formatVnd(f.amountDue)} · ${WAIVE_LABEL[f.waiveReason ?? "manual"] ?? "Miễn"}`
                      : formatVnd(f.amountDue)}
                </p>
              </Link>
              {f.billingMode === "monthly" && (
                <div className="flex items-center gap-2">
                  {f.status !== "paid" && (
                    <button
                      disabled={pending}
                      onClick={() =>
                        run(f.id, f.status === "waived" ? "unpaid" : "waived", () =>
                          setFeeWaived(f.id, f.status !== "waived"),
                        )
                      }
                      className={`h-9 rounded-full border px-3 text-xs font-semibold disabled:opacity-50 ${
                        f.status === "waived"
                          ? "border-zinc-400 bg-zinc-100 text-zinc-700"
                          : "border-zinc-200 text-zinc-500"
                      }`}
                    >
                      Miễn
                    </button>
                  )}
                  {f.status !== "waived" && (
                    <button
                      disabled={pending}
                      onClick={() =>
                        run(f.id, f.status === "paid" ? "unpaid" : "paid", () => setFeePaid(f.id, f.status !== "paid"))
                      }
                      className={`h-9 min-w-20 rounded-full border px-3 text-xs font-semibold disabled:opacity-50 ${
                        f.status === "paid"
                          ? "border-brand-600 bg-brand-100 text-brand-700"
                          : "border-zinc-300 text-zinc-700"
                      }`}
                    >
                      {f.status === "paid" ? "Đã nộp" : "Chưa nộp"}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
