"use client";

import { useActionState, useState } from "react";
import type { TxFormState, TxFormValues } from "@/app/actions/fund";
import { Choice } from "@/app/ui/choice";
import { inputClass, labelClass, primaryButtonClass, selectClass } from "@/app/ui/form";
import { MoneyInput } from "@/app/ui/money-input";
import { formatVnd, type PriceSettings } from "@/lib/billing";
import { MEMBER_FEE_OPTION } from "@/lib/categories";
import { formatMonthLabel } from "@/lib/dates";
import type { CategoryOption } from "@/lib/fund";
import { MAX_PREPAY_COUNT, oldDebts, planPrepay, type PrepayMember } from "@/lib/prepay";

type Props = {
  action: (prev: TxFormState, formData: FormData) => Promise<TxFormState>;
  initialValues: TxFormValues;
  categories: CategoryOption[];
  submitLabel: string;
  /** Given only on the new-line form: offers "Thu tiền sân" among the income kinds. */
  memberFees?: MemberFeeData;
};

/** fromMonth: this month (YYYY-MM); paying ahead counts from it. */
type MemberFeeData = { members: PrepayMember[]; settings: PriceSettings; fromMonth: string };

/** Which club's book the line goes into, so a line is not written to the wrong club. */
export function ClubBadge({ name }: { name: string }) {
  return (
    <p className="flex items-center gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
      CLB
      <span className="min-w-0 truncate font-bold">{name}</span>
    </p>
  );
}

export function TxForm({ action, initialValues, categories, submitLabel, memberFees }: Props) {
  const [state, formAction, pending] = useActionState(action, { error: null, values: initialValues });
  const v = state.values;
  const [type, setType] = useState(v.type);
  const [categoryId, setCategoryId] = useState(v.category_id);
  const options = [
    ...(type === "income" && memberFees ? [{ id: MEMBER_FEE_OPTION, type, label: "Thu tiền sân" } as const] : []),
    ...categories.filter((c) => c.type === type),
  ];
  const pickType = (next: string) => {
    setType(next);
    setCategoryId(v.category_id);
  };
  const collectingFees = type === "income" && memberFees !== undefined && categoryId === MEMBER_FEE_OPTION;

  return (
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex gap-2">
        <legend className="sr-only">Thu hay chi</legend>
        <Choice name="type" value="expense" label="Khoản chi" checked={v.type === "expense"} onChange={pickType} />
        <Choice name="type" value="income" label="Khoản thu" checked={v.type === "income"} onChange={pickType} />
      </fieldset>
      <label className={labelClass}>
        Loại
        <select
          key={type}
          name="category_id"
          defaultValue={options.some((o) => o.id === v.category_id) ? v.category_id : ""}
          onChange={(e) => setCategoryId(e.target.value)}
          required
          className={selectClass}
        >
          <option value="" disabled>
            Chọn loại
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {collectingFees ? (
        <MemberFeeFields
          data={memberFees}
          initialMemberId={v.member_id ?? ""}
          initialFeeIds={v.fee_ids ?? []}
          initialMonths={Number(v.months ?? "1")}
        />
      ) : (
        <label className={labelClass}>
          Số tiền
          <div className="relative">
            <MoneyInput name="amount" initialValue={v.amount} required className={`${inputClass} pr-8`} />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-faint">đ</span>
          </div>
        </label>
      )}
      <label className={labelClass}>
        Ngày
        <input type="date" name="occurred_on" defaultValue={v.occurred_on} required className={inputClass} />
      </label>
      <label className={labelClass}>
        Ghi chú
        <input name="description" defaultValue={v.description} placeholder="Ví dụ: 2 hộp cầu" className={inputClass} />
      </label>
      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error}
      </p>
      <button disabled={pending} className={primaryButtonClass}>
        {pending ? "Đang lưu..." : submitLabel}
      </button>
    </form>
  );
}

/**
 * "Thu tiền sân": pick a fixed member, tick any old unpaid months, and choose how many months to pay
 * from this month on. The amount is the sum of all those months.
 */
function MemberFeeFields({
  data,
  initialMemberId,
  initialFeeIds,
  initialMonths,
}: {
  data: MemberFeeData;
  initialMemberId: string;
  initialFeeIds: string[];
  initialMonths: number;
}) {
  const { members, settings, fromMonth } = data;
  const [memberId, setMemberId] = useState(members.some((m) => m.id === initialMemberId) ? initialMemberId : "");
  const [picked, setPicked] = useState(() => new Set(initialFeeIds));
  const member = members.find((m) => m.id === memberId);
  const [count, setCount] = useState(member?.canPayAhead ? initialMonths : 0);
  const debts = member ? oldDebts(member, fromMonth) : [];
  const ahead = member ? planPrepay(member, fromMonth, count, settings) : [];
  const total =
    debts.filter((f) => picked.has(f.id)).reduce((sum, f) => sum + f.amount, 0) +
    ahead.reduce((sum, m) => sum + m.amount, 0);

  if (members.length === 0) {
    return <p className="text-sm text-muted">Chưa có thành viên cố định nào.</p>;
  }

  return (
    <>
      <label className={labelClass}>
        Thành viên
        <select
          name="member_id"
          value={memberId}
          onChange={(e) => {
            const next = members.find((m) => m.id === e.target.value);
            setMemberId(e.target.value);
            setPicked(new Set());
            setCount(next?.canPayAhead ? 1 : 0);
          }}
          required
          className={selectClass}
        >
          <option value="" disabled>
            Chọn thành viên cố định
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.canPayAhead ? "" : " (đã nghỉ)"}
            </option>
          ))}
        </select>
      </label>
      {member && debts.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold text-muted">Tháng cũ còn nợ</legend>
          {debts.map((f) => (
            <label
              key={f.id}
              className="flex h-11 cursor-pointer items-center gap-3 rounded-2xl border border-line-strong bg-surface px-4 text-sm has-checked:border-cta"
            >
              <input
                type="checkbox"
                name="fee_ids"
                value={f.id}
                checked={picked.has(f.id)}
                onChange={(e) => {
                  const next = new Set(picked);
                  if (e.target.checked) next.add(f.id);
                  else next.delete(f.id);
                  setPicked(next);
                }}
                className="size-4 accent-brand-600"
              />
              <span className="flex-1 font-semibold text-ink">{formatMonthLabel(f.month)}</span>
              <span className="text-muted">{formatVnd(f.amount)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {member?.canPayAhead && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-muted">Số tháng đóng, tính từ tháng này</span>
            <div className="flex items-center gap-1">
              <StepButton label="Bớt 1 tháng" disabled={count <= 0} onClick={() => setCount(count - 1)}>
                −
              </StepButton>
              <input
                name="months"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_PREPAY_COUNT}
                value={count}
                onChange={(e) => setCount(Math.max(0, Math.min(MAX_PREPAY_COUNT, Math.trunc(Number(e.target.value) || 0))))}
                aria-label="Số tháng đóng"
                className="h-10 w-14 rounded-2xl border border-line-strong bg-surface text-center font-bold"
              />
              <StepButton label="Thêm 1 tháng" disabled={count >= MAX_PREPAY_COUNT} onClick={() => setCount(count + 1)}>
                +
              </StepButton>
            </div>
          </div>
          {ahead.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-2xl bg-surface-2 px-4 py-2 text-sm">
              {ahead.map((m) => (
                <li key={m.month} className="flex justify-between">
                  <span>{formatMonthLabel(m.month)}</span>
                  <span className="text-muted">{formatVnd(m.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          {ahead.length > 0 && ahead[0].month !== fromMonth && (
            <p className="text-xs text-muted">Tháng đã nộp hoặc tính theo buổi được bỏ qua.</p>
          )}
        </div>
      )}
      <div className={labelClass}>
        Số tiền
        <p className="flex h-12 items-center rounded-2xl border border-line bg-surface-2 px-4 text-base font-bold text-ink">
          {formatVnd(total)}
        </p>
      </div>
    </>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface text-lg font-bold disabled:opacity-40"
    >
      {children}
    </button>
  );
}
