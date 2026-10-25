"use client";

import { useActionState } from "react";
import {
  archiveClub,
  updateClubInfo,
  updatePrices,
  type ClubInfoState,
  type PricesState,
} from "@/app/actions/settings";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";

function FormStatus({ error, saved }: { error: string | null; saved: boolean }) {
  return (
    <p aria-live="polite" className={`min-h-5 text-sm ${error ? "text-red-600" : "text-brand-700"}`}>
      {error ?? (saved ? "Đã lưu." : "")}
    </p>
  );
}

export function ClubInfoForm({ initial }: { initial: ClubInfoState["values"] }) {
  const [state, formAction, pending] = useActionState(updateClubInfo, { error: null, saved: false, values: initial });
  const v = state.values;
  return (
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-3">
      <label className={labelClass}>
        Tên CLB
        <input name="name" defaultValue={v.name} required className={inputClass} />
      </label>
      <label className={labelClass}>
        Tên sân
        <input name="venue_name" defaultValue={v.venue_name} className={inputClass} />
      </label>
      <label className={labelClass}>
        Địa chỉ sân
        <input name="venue_address" defaultValue={v.venue_address} className={inputClass} />
      </label>
      <FormStatus error={state.error} saved={state.saved} />
      <button disabled={pending} className={primaryButtonClass}>
        {pending ? "Đang lưu..." : "Lưu thông tin CLB"}
      </button>
    </form>
  );
}

function PriceInput({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label className={labelClass}>
      {label}
      <div className="relative">
        <input name={name} defaultValue={value} inputMode="numeric" className={`${inputClass} pr-8`} />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400">đ</span>
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
