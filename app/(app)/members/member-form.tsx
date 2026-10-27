"use client";

import { useActionState, useState } from "react";
import type { MemberFormState } from "@/app/actions/members";
import type { MemberFormValues } from "@/lib/members";
import { Choice } from "@/app/ui/choice";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";

type Props = {
  action: (prev: MemberFormState, formData: FormData) => Promise<MemberFormState>;
  initialValues: MemberFormValues;
  submitLabel: string;
  /** The Đang chơi / Nghỉ choice only makes sense for an existing member. */
  showStatus?: boolean;
};

export function MemberForm({ action, initialValues, submitLabel, showStatus }: Props) {
  const [state, formAction, pending] = useActionState(action, { error: null, values: initialValues });
  const v = state.values;
  const [memberType, setMemberType] = useState(v.member_type);

  // key makes React rebuild the fields from the returned values after a failed save.
  return (
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-4">
      <label className={labelClass}>
        Tên
        <input name="full_name" defaultValue={v.full_name} required className={inputClass} />
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1.5 text-sm font-semibold text-muted">Giới tính</legend>
        <div className="flex gap-2">
          <Choice name="gender" value="male" label="Nam" checked={v.gender === "male"} />
          <Choice name="gender" value="female" label="Nữ" checked={v.gender === "female"} />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1.5 text-sm font-semibold text-muted">Loại</legend>
        <div className="flex gap-2">
          <Choice name="member_type" value="fixed" label="Cố định" checked={v.member_type === "fixed"} onChange={setMemberType} />
          <Choice name="member_type" value="guest" label="Vãng lai" checked={v.member_type === "guest"} onChange={setMemberType} />
        </div>
      </fieldset>

      {memberType === "fixed" && (
        <label className={labelClass}>
          Cố định từ ngày
          <input type="date" name="fixed_since" defaultValue={v.fixed_since} required className={inputClass} />
          <span className="mt-1 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">
            Vào giữa tháng thì tháng đó tính theo buổi, giá vãng lai. Từ tháng sau đóng phí tháng.
          </span>
        </label>
      )}

      {showStatus && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1.5 text-sm font-semibold text-muted">Trạng thái</legend>
          <div className="flex gap-2">
            <Choice name="status" value="active" label="Đang chơi" checked={v.status === "active"} />
            <Choice name="status" value="inactive" label="Nghỉ" checked={v.status === "inactive"} />
          </div>
          {v.status === "inactive" && memberType === "fixed" && (
            <p className="mt-1 text-xs text-muted">Chuyển lại Đang chơi thì ngày cố định tự đổi thành hôm nay.</p>
          )}
        </fieldset>
      )}

      <label className={labelClass}>
        Số điện thoại
        <input name="phone" type="tel" inputMode="tel" defaultValue={v.phone} className={inputClass} />
      </label>

      <label className={labelClass}>
        Ghi chú
        <textarea
          name="note"
          defaultValue={v.note}
          rows={2}
          className="w-full rounded-2xl border border-line-strong bg-surface px-4 py-3 text-base text-ink outline-none focus:border-2 focus:border-brand-600"
        />
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
