"use client";

import { useActionState } from "react";
import { createClub, type ClubFormState } from "@/app/actions/clubs";
import { CourtSelect, type CourtOption } from "@/app/ui/court-select";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";

const initialState: ClubFormState = { error: null, values: { name: "", court_id: "" } };

/** `redirectTo` sends the user to that page after creating; without it the current page re-renders. */
export function ClubForm({ courts, redirectTo }: { courts: CourtOption[]; redirectTo?: "/settings" }) {
  const [state, formAction, pending] = useActionState(createClub, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {redirectTo && <input type="hidden" name="redirect_to" value={redirectTo} />}
      <label className={labelClass}>
        Tên CLB
        <input name="name" defaultValue={state.values.name} required className={inputClass} />
      </label>
      <CourtSelect
        courts={courts}
        value={state.values.court_id}
        emptyLabel="Chưa chọn sân"
        emptyHint="Chưa có sân. Tạo CLB xong, thêm sân trong Cài đặt."
      />
      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error}
      </p>
      <button disabled={pending} className={primaryButtonClass}>
        {pending ? "Đang tạo..." : "Tạo CLB"}
      </button>
    </form>
  );
}
