"use client";

import { useActionState } from "react";
import { deleteCourt, type CourtFormState } from "@/app/actions/courts";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";
import type { CourtFormValues } from "@/lib/court-form";
import { PriceInput } from "../settings-forms";

type Props = {
  action: (prev: CourtFormState, formData: FormData) => Promise<CourtFormState>;
  initialValues: CourtFormValues;
  submitLabel: string;
};

export function CourtForm({ action, initialValues, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, { error: null, values: initialValues });
  const v = state.values;
  return (
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-4">
      <label className={labelClass}>
        Tên sân
        <input name="name" defaultValue={v.name} required className={inputClass} />
      </label>
      <label className={labelClass}>
        Địa chỉ
        <input name="address" defaultValue={v.address} className={inputClass} />
      </label>
      <PriceInput name="price" label="Giá thuê mỗi giờ" value={v.price} unit="đ/giờ" />
      <label className={labelClass}>
        Số người tối đa
        <input
          name="max_players"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          defaultValue={v.max_players}
          placeholder="Ví dụ: 16"
          className={inputClass}
        />
      </label>
      <p className="text-xs text-muted">Giá và số người tối đa chỉ để xem. Tiền sân vẫn ghi tay trong Quỹ.</p>
      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error}
      </p>
      <button disabled={pending} className={primaryButtonClass}>
        {pending ? "Đang lưu..." : submitLabel}
      </button>
    </form>
  );
}

export function DeleteCourtButton({ courtId, courtName }: { courtId: string; courtName: string }) {
  const [state, formAction, pending] = useActionState(deleteCourt.bind(null, courtId), { error: null });
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Xóa sân "${courtName}"?`)) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <p aria-live="polite" className="text-sm text-red-600">
        {state.error}
      </p>
      <button
        disabled={pending}
        className="h-11 w-full rounded-full border border-red-200 text-sm font-semibold text-red-600"
      >
        {pending ? "Đang xóa..." : "Xóa sân này"}
      </button>
    </form>
  );
}
