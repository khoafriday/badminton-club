"use client";

import { useActionState } from "react";
import {
  archiveClub,
  updateClubInfo,
  updatePrices,
  type ClubInfoState,
  type PricesState,
} from "@/app/actions/settings";
import { CourtSelect, type CourtOption } from "@/app/ui/court-select";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";

function FormStatus({ error, saved }: { error: string | null; saved: boolean }) {
  return (
    <p aria-live="polite" className={`min-h-5 text-sm ${error ? "text-red-600" : "text-brand-700"}`}>
      {error ?? (saved ? "Đã lưu." : "")}
    </p>
  );
}

export function ClubInfoForm({ initial, courts }: { initial: ClubInfoState["values"]; courts: CourtOption[] }) {
  const [state, formAction, pending] = useActionState(updateClubInfo, { error: null, saved: false, values: initial });
  // Server values unless the last save failed: adding the first court picks it for the club from another page.
  const v = state.error ? state.values : initial;
  return (
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-3">
      <label className={labelClass}>
        Tên CLB
        <input name="name" defaultValue={v.name} required className={inputClass} />
      </label>
      <CourtSelect courts={courts} value={v.court_id} emptyHint="Chưa có sân. Thêm sân ở mục Sân cầu bên dưới." />
      <FormStatus error={state.error} saved={state.saved} />
      <button disabled={pending} className={primaryButtonClass}>
        {pending ? "Đang lưu..." : "Lưu thông tin CLB"}
      </button>
    </form>
  );
}

export function PriceInput({
  name,
  label,
  value,
  unit = "đ",
}: {
  name: string;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <label className={labelClass}>
      {label}
      <div className="relative">
        <input
          name={name}
          defaultValue={value}
          inputMode="numeric"
          className={`${inputClass} ${unit.length > 1 ? "pr-16" : "pr-8"}`}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400">{unit}</span>
      </div>
    </label>
  );
}

export function PricesForm({ initial }: { initial: PricesState["values"] }) {
  const [state, formAction, pending] = useActionState(updatePrices, { error: null, saved: false, values: initial });
  const v = state.values;
  return (
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-3">
      <p className="text-sm font-semibold">Phí tháng (cố định)</p>
      <div className="grid grid-cols-2 gap-3">
        <PriceInput name="monthly_fee_male" label="Nam" value={v.monthly_fee_male} />
        <PriceInput name="monthly_fee_female" label="Nữ" value={v.monthly_fee_female} />
      </div>
      <p className="mt-2 text-sm font-semibold">Giá mỗi buổi (vãng lai)</p>
      <div className="grid grid-cols-2 gap-3">
        <PriceInput name="guest_price_male" label="Nam" value={v.guest_price_male} />
        <PriceInput name="guest_price_female" label="Nữ" value={v.guest_price_female} />
      </div>
      <p className="text-xs text-zinc-500">Đổi giá chỉ áp dụng cho buổi và tháng mới. Số tiền đã ghi không đổi.</p>
      <FormStatus error={state.error} saved={state.saved} />
      <button disabled={pending} className={primaryButtonClass}>
        {pending ? "Đang lưu..." : "Lưu giá"}
      </button>
    </form>
  );
}

export function ArchiveClubButton({ clubName }: { clubName: string }) {
  return (
    <form
      action={archiveClub}
      onSubmit={(e) => {
        if (!confirm(`Xóa CLB "${clubName}"? Dữ liệu tiền vẫn được giữ trong database.`)) e.preventDefault();
      }}
    >
      <button className="h-11 w-full rounded-lg border border-red-200 text-sm font-semibold text-red-600">
        Xóa CLB này
      </button>
    </form>
  );
}
