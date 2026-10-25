"use client";

import { useActionState, useState } from "react";
import type { TxFormState, TxFormValues } from "@/app/actions/fund";
import { Choice } from "@/app/ui/choice";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";
import type { CategoryOption } from "@/lib/fund";

type Props = {
  action: (prev: TxFormState, formData: FormData) => Promise<TxFormState>;
  initialValues: TxFormValues;
  categories: CategoryOption[];
  submitLabel: string;
};

export function TxForm({ action, initialValues, categories, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, { error: null, values: initialValues });
  const v = state.values;
  const [type, setType] = useState(v.type);
  const options = categories.filter((c) => c.type === type);

  return (
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex gap-2">
        <legend className="sr-only">Thu hay chi</legend>
        <Choice name="type" value="expense" label="Khoản chi" checked={v.type === "expense"} onChange={setType} />
        <Choice name="type" value="income" label="Khoản thu" checked={v.type === "income"} onChange={setType} />
      </fieldset>
      <label className={labelClass}>
        Loại
        <select
          key={type}
          name="category_id"
          defaultValue={options.some((o) => o.id === v.category_id) ? v.category_id : ""}
          required
          className={inputClass}
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
      <label className={labelClass}>
        Số tiền
        <div className="relative">
          <input name="amount" defaultValue={v.amount} inputMode="numeric" required className={`${inputClass} pr-8`} />
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-faint">đ</span>
        </div>
      </label>
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
