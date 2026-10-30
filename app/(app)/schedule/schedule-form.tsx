"use client";

import { useActionState } from "react";
import type { ScheduleFormState } from "@/app/actions/schedule";
import { Choice } from "@/app/ui/choice";
import { CourtSelect, type CourtOption } from "@/app/ui/court-select";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";
import { useLocale } from "@/app/ui/locale";
import { weekdayShort } from "@/lib/dates";
import { translator } from "@/lib/i18n";
import type { ScheduleFormValues } from "@/lib/schedule-forms";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

type Props = {
  action: (prev: ScheduleFormState, formData: FormData) => Promise<ScheduleFormState>;
  initialValues: ScheduleFormValues;
  courts: CourtOption[];
  submitLabel: string;
};

export function ScheduleForm({ action, initialValues, courts, submitLabel }: Props) {
  const locale = useLocale();
  const t = translator(locale);
  const [state, formAction, pending] = useActionState(action, { error: null, values: initialValues });
  const v = state.values;
  return (
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1.5 text-sm font-semibold text-muted">{t("Thứ")}</legend>
        <div className="flex gap-1">
          {WEEKDAYS.map((day) => (
            <Choice
              key={day}
              name="weekday"
              value={String(day)}
              label={weekdayShort(day, locale)}
              checked={v.weekday === String(day)}
            />
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          {t("Bắt đầu", { context: "time" })}
          <input type="time" name="start_time" defaultValue={v.start_time} required className={inputClass} />
        </label>
        <label className={labelClass}>
          {t("Kết thúc")}
          <input type="time" name="end_time" defaultValue={v.end_time} required className={inputClass} />
        </label>
      </div>
      <CourtSelect
        courts={courts}
        value={v.court_id}
        emptyLabel={null}
        emptyHint="Chưa có sân. Thêm sân trong Cài đặt."
      />
      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error && t(state.error)}
      </p>
      <button disabled={pending} className={primaryButtonClass}>
        {t(pending ? "Đang lưu..." : submitLabel)}
      </button>
    </form>
  );
}
