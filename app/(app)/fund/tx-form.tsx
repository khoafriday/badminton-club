"use client";

import { useActionState, useState } from "react";
import type { TxFormState, TxFormValues } from "@/app/actions/fund";
import { Choice } from "@/app/ui/choice";
import { inputClass, labelClass, primaryButtonClass, selectClass } from "@/app/ui/form";
import { MoneyInput } from "@/app/ui/money-input";
import { formatVnd } from "@/lib/billing";
import { MEMBER_FEE_OPTION } from "@/lib/categories";
import { formatMonthLabel } from "@/lib/dates";
import type { UnpaidFee } from "@/lib/fees";
import type { CategoryOption } from "@/lib/fund";

type Props = {
  action: (prev: TxFormState, formData: FormData) => Promise<TxFormState>;
  initialValues: TxFormValues;
  categories: CategoryOption[];
  submitLabel: string;
  /** Given only on the new-line form: offers "Thu tiền sân" among the income kinds. */
  unpaidFees?: UnpaidFee[];
};

export function TxForm({ action, initialValues, categories, submitLabel, unpaidFees }: Props) {
  const [state, formAction, pending] = useActionState(action, { error: null, values: initialValues });
  const v = state.values;
  const [type, setType] = useState(v.type);
  const [categoryId, setCategoryId] = useState(v.category_id);
  const options = [
    ...(type === "income" && unpaidFees ? [{ id: MEMBER_FEE_OPTION, type, label: "Thu tiền sân" } as const] : []),
    ...categories.filter((c) => c.type === type),
  ];
  const pickType = (next: string) => {
    setType(next);
    setCategoryId(v.category_id);
  };
  const collectingFees = type === "income" && unpaidFees !== undefined && categoryId === MEMBER_FEE_OPTION;

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
        <MemberFeeFields fees={unpaidFees} initialMemberId={v.member_id ?? ""} initialFeeIds={v.fee_ids ?? []} />
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

/** "Thu tiền sân": pick a member, then any of their unpaid months. The amount is the sum of those months. */
function MemberFeeFields({
  fees,
  initialMemberId,
  initialFeeIds,
}: {
  fees: UnpaidFee[];
  initialMemberId: string;
  initialFeeIds: string[];
}) {
  const members = [...new Map(fees.map((f) => [f.memberId, f.memberName])).entries()];
  const [memberId, setMemberId] = useState(members.some(([id]) => id === initialMemberId) ? initialMemberId : "");
  const [picked, setPicked] = useState(() => new Set(initialFeeIds));
  const months = fees.filter((f) => f.memberId === memberId);
  const total = months.filter((f) => picked.has(f.id)).reduce((sum, f) => sum + f.amount, 0);

  if (members.length === 0) {
    return <p className="text-sm text-muted">Không ai còn nợ tiền sân.</p>;
  }

  return (
    <>
      <label className={labelClass}>
        Thành viên
        <select
          name="member_id"
          value={memberId}
          onChange={(e) => {
            setMemberId(e.target.value);
            setPicked(new Set());
          }}
          required
          className={selectClass}
        >
          <option value="" disabled>
            Chọn thành viên
          </option>
          {members.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {memberId && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold text-muted">Tiền sân tháng</legend>
          {months.map((f) => (
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
      <div className={labelClass}>
        Số tiền
        <p className="flex h-12 items-center rounded-2xl border border-line bg-surface-2 px-4 text-base font-bold text-ink">
          {formatVnd(total)}
        </p>
      </div>
    </>
  );
}
