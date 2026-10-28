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
  /** Paid earlier at the old fee; amountDue is what the fee rise added. */
  prepaid: number;
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
      <section className="card mx-5 mt-3 grid grid-cols-3 gap-2 p-2.5 text-center">
        <div className="rounded-2xl bg-surface-2 px-1 py-2.5">
          <p className="text-xs text-muted">Phải thu</p>
          <p className="text-sm font-bold tracking-tight">{formatVnd(t.due)}</p>
        </div>
        <div className="rounded-2xl bg-surface-2 px-1 py-2.5">
          <p className="text-xs text-muted">Đã thu</p>
          <p className="text-sm font-bold tracking-tight text-brand-700">{formatVnd(t.paid)}</p>
        </div>
        <div className="rounded-2xl bg-surface-2 px-1 py-2.5">
          <p className="text-xs text-muted">Còn nợ</p>
          <p className={`text-sm font-bold tracking-tight ${t.outstanding > 0 ? "text-red-600" : ""}`}>
            {formatVnd(t.outstanding)}
          </p>
        </div>
      </section>
      {error && (
        <p role="alert" className="mx-5 mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {list.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">Không có phiếu phí tháng nào trong tháng này.</p>
      ) : (
        <ul className="mx-5 mt-3 flex flex-col gap-2">
          {list.map((f) => (
            <li key={f.id} className="card flex min-h-16 items-center gap-3 px-4 py-2">
              <Link href={`/members/${f.memberId}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold">{f.name}</p>
                <p className="text-xs text-muted">
                  {f.billingMode === "per_session"
                    ? "Vào giữa tháng, tính theo buổi"
                    : f.status === "waived"
                      ? `${formatVnd(f.amountDue)} · ${WAIVE_LABEL[f.waiveReason ?? "manual"] ?? "Miễn"}`
                      : f.prepaid > 0
                        ? `Đã đóng ${formatVnd(f.prepaid)}, ${f.status === "paid" ? "đã bù" : "bù thêm"} ${formatVnd(f.amountDue)}`
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
                      className={`h-9 rounded-full px-3 text-xs font-bold disabled:opacity-50 ${
                        f.status === "waived" ? "bg-cta text-on-cta" : "bg-surface-2 text-muted"
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
                      className={`h-9 min-w-20 rounded-full px-3 text-xs font-bold disabled:opacity-50 ${
                        f.status === "paid" ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-600"
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
