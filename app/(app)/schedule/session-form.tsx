"use client";

import { useActionState, useState } from "react";
import type { SessionFormState } from "@/app/actions/schedule";
import { CourtSelect, type CourtOption } from "@/app/ui/court-select";
import { inputClass, labelClass, primaryButtonClass, selectClass } from "@/app/ui/form";
import type { SessionFormValues } from "@/lib/schedule-forms";

type Props = {
  action: (prev: SessionFormState, formData: FormData) => Promise<SessionFormState>;
  initialValues: SessionFormValues;
  courts: CourtOption[];
  submitLabel: string;
  /** Given on the new-session form: the session can be for any of the user's clubs. */
  clubs?: ClubOption[];
};

/** court_id: the club's court, picked first when the club is chosen. */
type ClubOption = { id: string; name: string; court_id: string | null };

export function SessionForm({ action, initialValues, courts, submitLabel, clubs }: Props) {
  const [state, formAction, pending] = useActionState(action, { error: null, values: initialValues });
  const v = state.values;
  return (
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-4">
      {clubs && <ClubAndCourt clubs={clubs} courts={courts} initialClubId={v.club_id ?? ""} initialCourtId={v.court_id} />}
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
      {!clubs && (
        <CourtSelect
          courts={courts}
          value={v.court_id}
          emptyLabel={null}
          emptyHint="Chưa có sân. Thêm sân trong Cài đặt."
        />
      )}
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

/** CLB first; picking another club also picks that club's court. */
function ClubAndCourt({
  clubs,
  courts,
  initialClubId,
  initialCourtId,
}: {
  clubs: ClubOption[];
  courts: CourtOption[];
  initialClubId: string;
  initialCourtId: string;
}) {
  const [clubId, setClubId] = useState(initialClubId);
  const [courtId, setCourtId] = useState(initialCourtId);
  return (
    <>
      <label className={labelClass}>
        CLB
        <select
          name="club_id"
          value={clubId}
          onChange={(e) => {
            setClubId(e.target.value);
            setCourtId(clubs.find((c) => c.id === e.target.value)?.court_id ?? "");
          }}
          className={selectClass}
        >
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <CourtSelect
        key={courtId}
        courts={courts}
        value={courtId}
        emptyLabel={null}
        emptyHint="Chưa có sân. Thêm sân trong Cài đặt."
      />
    </>
  );
}
