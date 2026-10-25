"use client";

/** A radio button styled as a pill. Used for Nam/Nữ, Cố định/Vãng lai, weekdays and similar choices. */
export function Choice({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-surface px-2 text-sm font-semibold text-ink has-checked:border-cta has-checked:bg-cta has-checked:text-on-cta">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={checked}
        onChange={() => onChange?.(value)}
        className="sr-only"
      />
      {label}
    </label>
  );
}
