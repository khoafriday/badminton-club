import { inputClass, labelClass } from "./form";

export type CourtOption = { id: string; name: string };

type Props = {
  courts: CourtOption[];
  value: string;
  /** Label of the "no court" choice; null when a court must be picked whenever one exists. */
  emptyLabel: string | null;
  emptyHint: string;
};

/** SAN-1: a court picked from the courts in Settings. */
export function CourtSelect({ courts, value, emptyLabel, emptyHint }: Props) {
  return (
    <label className={labelClass}>
      Sân
      <select name="court_id" defaultValue={value} className={inputClass}>
        {(emptyLabel !== null || courts.length === 0) && <option value="">{emptyLabel ?? "Chưa có sân"}</option>}
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
