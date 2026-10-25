"use client";

import { useActionState } from "react";
import { createClub, type ClubFormState } from "@/app/actions/clubs";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";

const initialState: ClubFormState = { error: null, values: { name: "", venue_name: "", venue_address: "" } };

/** `redirectTo` sends the user to that page after creating; without it the current page re-renders. */
export function ClubForm({ redirectTo }: { redirectTo?: "/settings" }) {
  const [state, formAction, pending] = useActionState(createClub, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {redirectTo && <input type="hidden" name="redirect_to" value={redirectTo} />}
      <label className={labelClass}>
        Tên CLB
        <input name="name" defaultValue={state.values.name} required className={inputClass} />
      </label>
      <label className={labelClass}>
        Tên sân
        <input name="venue_name" defaultValue={state.values.venue_name} className={inputClass} />
      </label>
      <label className={labelClass}>
        Địa chỉ sân
        <input name="venue_address" defaultValue={state.values.venue_address} className={inputClass} />
      </label>
      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error}
      </p>
      <button disabled={pending} className={primaryButtonClass}>
        {pending ? "Đang tạo..." : "Tạo CLB"}
      </button>
    </form>
  );
}
