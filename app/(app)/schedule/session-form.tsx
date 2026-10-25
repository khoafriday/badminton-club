"use client";

import { useActionState } from "react";
import type { SessionFormState } from "@/app/actions/schedule";
import { CourtSelect, type CourtOption } from "@/app/ui/court-select";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";
import type { SessionFormValues } from "@/lib/schedule-forms";

type Props = {
  action: (prev: SessionFormState, formData: FormData) => Promise<SessionFormState>;
  initialValues: SessionFormValues;
  courts: CourtOption[];
  submitLabel: string;
};

export function SessionForm({ action, initialValues, courts, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, { error: null, values: initialValues });
  const v = state.values;
  return (
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-4">
      <label className={labelClass}>
        Ngày
        <input type="date" name="session_date" defaultValue={v.session_date} required className={inputClass} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          Bắt đầu
          <input type="time" name="start_time" defaultValue={v.start_time} required className={inputClass} />
        </label>
        <label className={labelClass}>
          Kết thúc
          <input type="time" name="end_time" defaultValue={v.end_time} required className={inputClass} />
        </label>
      </div>
      <CourtSelect
        courts={courts}
        value={v.court_id}
        emptyLabel={null}
        emptyHint="Chưa có sân. Thêm sân trong Cài đặt."
      />
      <label className={labelClass}>
        Ghi chú
        <input name="note" defaultValue={v.note} className={inputClass} />
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
