"use client";

import { useActionState, useState } from "react";
import { issueFeeSlips } from "@/app/actions/fees";
import { labelClass, primaryButtonClass, selectClass } from "@/app/ui/form";
import { useLocale } from "@/app/ui/locale";
import { addMonths, formatMonthLabel } from "@/lib/dates";
import { translator } from "@/lib/i18n";

/** How many months the admin can make slips for in one go, the same as MAX_ISSUE_MONTHS on the server. */
const MAX_MONTHS = 12;
const COUNT_LABEL: Record<number, string> = { 3: "3 tháng (1 quý)", 6: "6 tháng", 12: "12 tháng (1 năm)" };

/**
 * "Tạo phiếu trước": slips of coming months for the chosen fixed members, so the club can collect by quarter or more.
 * Members then see those months under Đang nợ and can pay them with the QR.
 */
export function IssueForm({
  thisMonth,
  members,
}: {
  thisMonth: string;
  members: { id: string; name: string }[];
}) {
  const locale = useLocale();
  const t = translator(locale);
  const [state, formAction, pending] = useActionState(issueFeeSlips, { error: null, notice: null });
  const [fromMonth, setFromMonth] = useState(addMonths(thisMonth, 1));
  const [count, setCount] = useState(3);
  const [picked, setPicked] = useState(() => new Set(members.map((m) => m.id)));
  const lastMonth = addMonths(fromMonth, count - 1);

  return (
    <details className="card mx-5 mt-3 px-4 py-3" open={state.notice !== null || state.error !== null}>
      <summary className="flex min-h-11 cursor-pointer items-center justify-between font-bold">
        {t("Tạo phiếu các tháng tới")}
        <span className="text-xs font-semibold text-muted">{t("Thu theo quý, theo năm")}</span>
      </summary>
      {members.length === 0 ? (
        <p className="py-2 text-sm text-muted">{t("CLB chưa có thành viên cố định đang chơi.")}</p>
      ) : (
        <form action={formAction} className="mt-2 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              {t("Từ tháng")}
              <select
                name="from_month"
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
                className={selectClass}
              >
                {Array.from({ length: MAX_MONTHS }, (_, i) => addMonths(thisMonth, i + 1)).map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              {t("Số tháng")}
              <select
                name="count"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className={selectClass}
              >
                {Array.from({ length: MAX_MONTHS }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {COUNT_LABEL[n] ? t(COUNT_LABEL[n]) : t("{count} tháng", { count: n })}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-sm text-muted">
            {count === 1
              ? formatMonthLabel(fromMonth, locale)
              : `${formatMonthLabel(fromMonth, locale)} ${t("đến")} ${
                  locale === "en" ? formatMonthLabel(lastMonth, "en") : formatMonthLabel(lastMonth).toLowerCase()
                }`}
            {t(", giá phí tháng hiện tại. Tháng đã có phiếu thì giữ nguyên.")}
          </p>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 flex w-full items-center justify-between text-sm font-semibold text-muted">
              {t("Thành viên")} ({picked.size}/{members.length})
              <button
                type="button"
                onClick={() =>
                  setPicked(picked.size === members.length ? new Set() : new Set(members.map((m) => m.id)))
                }
                className="h-9 rounded-full bg-surface-2 px-3 text-xs font-bold text-ink"
              >
                {t(picked.size === members.length ? "Bỏ chọn hết" : "Chọn hết")}
              </button>
            </legend>
            {members.map((m) => (
              <label
                key={m.id}
                className="flex h-11 cursor-pointer items-center gap-3 rounded-2xl border border-line-strong bg-surface px-4 text-sm has-checked:border-cta"
              >
                <input
                  type="checkbox"
                  name="member"
                  value={m.id}
                  checked={picked.has(m.id)}
                  onChange={(e) => {
                    const next = new Set(picked);
                    if (e.target.checked) next.add(m.id);
                    else next.delete(m.id);
                    setPicked(next);
                  }}
                  className="size-4 accent-brand-600"
                />
                <span className="flex-1 font-semibold text-ink">{m.name}</span>
              </label>
            ))}
          </fieldset>
          <p aria-live="polite" className={`min-h-5 text-sm ${state.error ? "text-red-600" : "text-brand-700"}`}>
            {state.error ? t(state.error) : (state.notice ?? "")}
          </p>
          <button disabled={pending || picked.size === 0} className={primaryButtonClass}>
            {pending ? t("Đang tạo...") : t("Tạo phiếu {count} tháng", { count })}
          </button>
        </form>
      )}
    </details>
  );
}
