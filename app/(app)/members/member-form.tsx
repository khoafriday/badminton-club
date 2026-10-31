"use client";

import { useActionState, useState } from "react";
import type { MemberFormState } from "@/app/actions/members";
import type { MemberFormValues } from "@/lib/members";
import { Choice } from "@/app/ui/choice";
import { inputClass, labelClass, primaryButtonClass } from "@/app/ui/form";
import { useLocale } from "@/app/ui/locale";
import { formatVnd } from "@/lib/billing";
import { formatFullDate, formatMonthLabel } from "@/lib/dates";
import { translator } from "@/lib/i18n";
import type { Candidate } from "@/lib/member-candidates";
import { MemberPicker } from "./member-picker";

type Props = {
  action: (prev: MemberFormState, formData: FormData) => Promise<MemberFormState>;
  initialValues: MemberFormValues;
  submitLabel: string;
  /** The Đang chơi / Nghỉ choice only makes sense for an existing member. */
  showStatus?: boolean;
  /** Today in Vietnam: the return day when a member on Nghỉ is switched back to Đang chơi. */
  today?: string;
  /** The last return day after a Nghỉ, shown under the status. */
  rejoinedOn?: string | null;
  /** Months after this one already paid: paid back if the member stops paying monthly. */
  refund?: { month: string; amount: number }[];
  /** Thêm thành viên: people already in the app who can be picked instead of typing a new member. */
  candidates?: Candidate[];
};

export function MemberForm({
  action,
  initialValues,
  submitLabel,
  showStatus,
  today,
  rejoinedOn,
  refund = [],
  candidates = [],
}: Props) {
  const locale = useLocale();
  const t = translator(locale);
  const [state, formAction, pending] = useActionState(action, { error: null, values: initialValues });
  const v = state.values;
  const [memberType, setMemberType] = useState(v.member_type);
  // Back from Nghỉ: billed from today, as the server also records (rejoinedOnAfterEdit).
  const [returnDate, setReturnDate] = useState<string | null>(null);
  // Kept after a failed save: the returned values still name the person picked.
  const [picked, setPicked] = useState(() => candidates.find((c) => c.id === v.source_member_id) ?? null);

  function pickStatus(status: string) {
    const back = initialValues.status === "inactive" && status === "active" && memberType === "fixed";
    setReturnDate(back && today ? today : null);
  }

  // key makes React rebuild the fields from the returned values after a failed save.
  return (
    <form
      key={JSON.stringify(v)}
      action={formAction}
      onSubmit={(e) => {
        if (refund.length === 0) return;
        const form = new FormData(e.currentTarget);
        if (form.get("status") === "active" && form.get("member_type") === "fixed") return;
        const total = refund.reduce((sum, m) => sum + m.amount, 0);
        const months = refund.map((m) => formatMonthLabel(m.month, locale)).join(", ");
        const ok = confirm(
          t('Hoàn {amount} cho {count} tháng đã đóng trước ({months})?\nApp sẽ ghi 1 khoản chi "Hoàn phí tháng" vào Quỹ.', {
            amount: formatVnd(total),
            count: refund.length,
            months,
          }),
        );
        if (!ok) e.preventDefault();
      }}
      className="flex flex-col gap-4"
    >
      {candidates.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-muted">{t("Chọn người đã có trong app")}</p>
          <MemberPicker candidates={candidates} picked={picked} onPick={setPicked} />
          {picked ? (
            <p className="text-xs text-muted">
              {t(
                picked.guestHere
                  ? "Chuyển người này từ vãng lai sang cố định, giữ các buổi đã đi."
                  : "Tên, giới tính, số điện thoại và tài khoản đăng nhập lấy theo người đã chọn.",
              )}
            </p>
          ) : (
            <p className="mt-2 text-center text-xs font-semibold text-muted uppercase">{t("Hoặc thêm người mới")}</p>
          )}
        </div>
      )}

      {!picked && (
        <>
          <label className={labelClass}>
            {t("Tên")}
            <input name="full_name" defaultValue={v.full_name} required className={inputClass} />
          </label>

          <label className={labelClass}>
            {t("Biệt danh")}
            <input name="nickname" defaultValue={v.nickname} className={inputClass} />
          </label>

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1.5 text-sm font-semibold text-muted">{t("Giới tính")}</legend>
            <div className="flex gap-2">
              <Choice name="gender" value="male" label={t("Nam")} checked={v.gender === "male"} />
              <Choice name="gender" value="female" label={t("Nữ")} checked={v.gender === "female"} />
            </div>
          </fieldset>
        </>
      )}

      {/* A new member is always fixed: guests are added in a session. An existing guest can become fixed here. */}
      {showStatus ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1.5 text-sm font-semibold text-muted">{t("Loại")}</legend>
          <div className="flex gap-2">
            <Choice name="member_type" value="fixed" label={t("Cố định")} checked={v.member_type === "fixed"} onChange={setMemberType} />
            <Choice name="member_type" value="guest" label={t("Vãng lai")} checked={v.member_type === "guest"} onChange={setMemberType} />
          </div>
        </fieldset>
      ) : (
        <input type="hidden" name="member_type" value="fixed" />
      )}

      {memberType === "fixed" && (
        <label className={labelClass}>
          {t("Cố định từ ngày")}
          <input type="date" name="fixed_since" defaultValue={v.fixed_since} required className={inputClass} />
          <span className="mt-1 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">
            {t("Vào giữa tháng thì tháng đó tính theo buổi, giá vãng lai. Từ tháng sau đóng phí tháng.")}
          </span>
        </label>
      )}

      {showStatus && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1.5 text-sm font-semibold text-muted">{t("Trạng thái")}</legend>
          <div className="flex gap-2">
            <Choice name="status" value="active" label={t("Đang chơi")} checked={v.status === "active"} onChange={pickStatus} />
            <Choice name="status" value="inactive" label={t("Nghỉ")} checked={v.status === "inactive"} onChange={pickStatus} />
          </div>
          {returnDate ? (
            <p className="mt-1 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">
              {t('Ngày chơi lại trong tháng là ngày {date}. Phí tính lại từ ngày này, ô "Cố định từ ngày" giữ nguyên.', {
                date: formatFullDate(returnDate),
              })}
            </p>
          ) : (
            rejoinedOn &&
            memberType === "fixed" &&
            initialValues.status === "active" && (
              <p className="mt-1 text-xs text-muted">
                {t("Chơi lại từ ngày {date}.", { date: formatFullDate(rejoinedOn) })}
              </p>
            )
          )}
        </fieldset>
      )}

      {!picked && (
        <>
          <label className={labelClass}>
            {t("Số điện thoại")}
            <input name="phone" type="tel" inputMode="tel" defaultValue={v.phone} className={inputClass} />
          </label>

          <label className={labelClass}>
            {t("Ghi chú")}
            <textarea
              name="note"
              defaultValue={v.note}
              rows={2}
              className="w-full rounded-2xl border border-line-strong bg-surface px-4 py-3 text-base text-ink outline-none focus:border-2 focus:border-brand-600"
            />
          </label>
        </>
      )}

      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error && t(state.error)}
      </p>
      <button disabled={pending} className={primaryButtonClass}>
        {t(pending ? "Đang lưu..." : submitLabel)}
      </button>
    </form>
  );
}
