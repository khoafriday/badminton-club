"use client";

import { useActionState } from "react";
import {
  archiveClub,
  updateClubInfo,
  updatePrices,
  type ClubInfoState,
  type PricesState,
} from "@/app/actions/settings";
import { updateBankAccount, type BankState } from "@/app/actions/payments";
import { CourtSelect, type CourtOption } from "@/app/ui/court-select";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";
import { useT } from "@/app/ui/locale";
import { MoneyInput } from "@/app/ui/money-input";

function FormStatus({ error, saved }: { error: string | null; saved: boolean }) {
  const t = useT();
  return (
    <p aria-live="polite" className={`min-h-5 text-sm ${error ? "text-red-600" : "text-brand-700"}`}>
      {error ? t(error) : saved ? t("Đã lưu.") : ""}
    </p>
  );
}

export function ClubInfoForm({ initial, courts }: { initial: ClubInfoState["values"]; courts: CourtOption[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(updateClubInfo, { error: null, saved: false, values: initial });
  // Server values unless the last save failed: adding the first court picks it for the club from another page.
  const v = state.error ? state.values : initial;
  return (
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-3">
      <label className={labelClass}>
        {t("Tên CLB")}
        <input name="name" defaultValue={v.name} required className={inputClass} />
      </label>
      <CourtSelect
        courts={courts}
        value={v.court_id}
        emptyLabel="Chưa chọn sân"
        emptyHint="Chưa có sân. Thêm sân ở mục Sân cầu bên dưới."
      />
      <FormStatus error={state.error} saved={state.saved} />
      <button disabled={pending} className={primaryButtonClass}>
        {t(pending ? "Đang lưu..." : "Lưu thông tin CLB")}
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
  const t = useT();
  return (
    <label className={labelClass}>
      {t(label)}
      <div className="relative">
        <MoneyInput name={name} initialValue={value} className={`${inputClass} ${unit.length > 1 ? "pr-16" : "pr-8"}`} />
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-faint">{t(unit)}</span>
      </div>
    </label>
  );
}

export function PricesForm({ initial }: { initial: PricesState["values"] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(updatePrices, { error: null, saved: false, values: initial });
  const v = state.values;
  return (
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-3">
      <p className="text-sm font-bold">{t("Phí tháng (cố định)")}</p>
      <div className="grid grid-cols-2 gap-3">
        <PriceInput name="monthly_fee_male" label="Nam" value={v.monthly_fee_male} />
        <PriceInput name="monthly_fee_female" label="Nữ" value={v.monthly_fee_female} />
      </div>
      <p className="mt-2 text-sm font-bold">{t("Giá mỗi buổi (vãng lai)")}</p>
      <div className="grid grid-cols-2 gap-3">
        <PriceInput name="guest_price_male" label="Nam" value={v.guest_price_male} />
        <PriceInput name="guest_price_female" label="Nữ" value={v.guest_price_female} />
      </div>
      <p className="text-xs text-muted">
        {t("Đổi giá chỉ áp dụng cho buổi và tháng mới. Riêng tháng sau đã đóng trước: tăng phí thì thu thêm chênh lệch.")}
      </p>
      <FormStatus error={state.error} saved={state.saved} />
      {state.notice && <p className="text-sm text-amber-700">{t(state.notice)}</p>}
      <button disabled={pending} className={primaryButtonClass}>
        {t(pending ? "Đang lưu..." : "Lưu giá")}
      </button>
    </form>
  );
}

export function ArchiveClubButton({ clubName }: { clubName: string }) {
  const t = useT();
  return (
    <form
      action={archiveClub}
      onSubmit={(e) => {
        if (!confirm(t('Xóa CLB "{name}"? Dữ liệu tiền vẫn được giữ trong database.', { name: clubName }))) {
          e.preventDefault();
        }
      }}
    >
      <button className="h-11 w-full rounded-full border border-red-200 text-sm font-semibold text-red-600">
        {t("Xóa CLB này")}
      </button>
    </form>
  );
}

export function BankAccountForm({ initial }: { initial: BankState["values"] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(updateBankAccount, { error: null, saved: false, values: initial });
  const v = state.values;
  return (
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-3">
      <p className="text-sm">
        {t("Ngân hàng:")} <span className="font-bold">TPBank</span>
      </p>
      <label className={labelClass}>
        {t("Số tài khoản")}
        <input name="bank_account_no" defaultValue={v.bank_account_no} inputMode="numeric" className={inputClass} />
      </label>
      <label className={labelClass}>
        {t("Tên chủ tài khoản")}
        <input name="bank_account_name" defaultValue={v.bank_account_name} className={inputClass} />
      </label>
      <p className="text-xs text-muted">
        {t(
          "Thành viên bấm Đóng tiền nợ ở Tổng quan để lấy mã QR. Tiền về tài khoản này thì app tự đánh Đã nộp (cần nối SePay). Để trống số tài khoản thì tắt QR.",
        )}
      </p>
      <FormStatus error={state.error} saved={state.saved} />
      <button disabled={pending} className={primaryButtonClass}>
        {t(pending ? "Đang lưu..." : "Lưu tài khoản")}
      </button>
    </form>
  );
}
