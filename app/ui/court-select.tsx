import { inputClass, labelClass } from "./form";

export type CourtOption = { id: string; name: string };

/** SAN-1: the club's court, picked from the courts in Settings. The MVP allows one per club. */
export function CourtSelect({ courts, value, emptyHint }: { courts: CourtOption[]; value: string; emptyHint: string }) {
  return (
    <label className={labelClass}>
      Sân
      <select name="court_id" defaultValue={value} className={inputClass}>
        <option value="">Chưa chọn sân</option>
        {courts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {courts.length === 0 && <span className="text-xs font-normal text-zinc-500">{emptyHint}</span>}
    </label>
  );
}
