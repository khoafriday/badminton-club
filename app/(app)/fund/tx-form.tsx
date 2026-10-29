"use client";

import { useActionState, useState } from "react";
import type { TxFormState, TxFormValues } from "@/app/actions/fund";
import { Choice } from "@/app/ui/choice";
import { inputClass, labelClass, primaryButtonClass, selectClass } from "@/app/ui/form";
import { useLocale, useT } from "@/app/ui/locale";
import { MoneyInput } from "@/app/ui/money-input";
import { formatVnd, type PriceSettings } from "@/lib/billing";
import { GUEST_FEE_OPTION, MEMBER_FEE_OPTION } from "@/lib/categories";
import { formatMonthLabel, formatShortDate } from "@/lib/dates";
import type { GuestDebtor } from "@/lib/debts";
import type { CategoryOption } from "@/lib/fund";
import { translator } from "@/lib/i18n";
import { MAX_PREPAY_COUNT, oldDebts, planPrepay, type PrepayMember } from "@/lib/prepay";

type Props = {
  action: (prev: TxFormState, formData: FormData) => Promise<TxFormState>;
  initialValues: TxFormValues;
  categories: CategoryOption[];
  submitLabel: string;
  /** Given only on the new-line form: offers "Thu tiền sân" among the income kinds. */
  memberFees?: MemberFeeData;
  /** Given only on the new-line form: offers "Thu phí vãng lai" among the income kinds. */
  guestFees?: GuestDebtor[];
};

/** fromMonth: this month (YYYY-MM); paying ahead counts from it. */
type MemberFeeData = { members: PrepayMember[]; settings: PriceSettings; fromMonth: string };

/** Which club's book the line goes into, so a line is not written to the wrong club. */
export function ClubBadge({ name }: { name: string }) {
  const t = useT();
  return (
    <p className="flex items-center gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
      {t("CLB")}
      <span className="min-w-0 truncate font-bold">{name}</span>
    </p>
  );
}

export function TxForm({ action, initialValues, categories, submitLabel, memberFees, guestFees }: Props) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, { error: null, values: initialValues });
  const v = state.values;
  const [type, setType] = useState(v.type);
  const [categoryId, setCategoryId] = useState(v.category_id);
  const options = [
    ...(type === "income" && memberFees ? [{ id: MEMBER_FEE_OPTION, type, label: "Thu tiền sân" } as const] : []),
    ...(type === "income" && guestFees ? [{ id: GUEST_FEE_OPTION, type, label: "Thu phí vãng lai" } as const] : []),
    ...categories.filter((c) => c.type === type),
  ];
  const pickType = (next: string) => {
    setType(next);
    setCategoryId(v.category_id);
  };
  const collectingFees = type === "income" && memberFees !== undefined && categoryId === MEMBER_FEE_OPTION;
  const collectingGuests = type === "income" && guestFees !== undefined && categoryId === GUEST_FEE_OPTION;

  return (
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex gap-2">
        <legend className="sr-only">{t("Thu hay chi")}</legend>
        <Choice name="type" value="expense" label={t("Khoản chi")} checked={v.type === "expense"} onChange={pickType} />
        <Choice name="type" value="income" label={t("Khoản thu")} checked={v.type === "income"} onChange={pickType} />
      </fieldset>
      <label className={labelClass}>
        {t("Loại")}
        <select
          key={type}
          name="category_id"
          defaultValue={options.some((o) => o.id === v.category_id) ? v.category_id : ""}
          onChange={(e) => setCategoryId(e.target.value)}
          required
          className={selectClass}
        >
          <option value="" disabled>
            {t("Chọn loại")}
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {t(o.label)}
            </option>
          ))}
        </select>
      </label>
      {collectingFees ? (
        <MemberFeeFields
          data={memberFees}
          initialMemberId={v.member_id ?? ""}
          initialFeeIds={v.fee_ids ?? []}
          initialMonths={Number(v.months ?? "1")}
        />
      ) : collectingGuests ? (
        <GuestFeeFields
          debtors={guestFees}
          initialMemberId={v.member_id ?? ""}
          initialIds={v.attendance_ids ?? []}
        />
      ) : (
        <label className={labelClass}>
          {t("Số tiền")}
          <div className="relative">
            <MoneyInput name="amount" initialValue={v.amount} required className={`${inputClass} pr-8`} />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-faint">đ</span>
          </div>
        </label>
      )}
      <label className={labelClass}>
        {t("Ngày")}
        <input type="date" name="occurred_on" defaultValue={v.occurred_on} required className={inputClass} />
      </label>
      <label className={labelClass}>
        {t("Ghi chú")}
        <input
          name="description"
          defaultValue={v.description}
          placeholder={t("Ví dụ: 2 hộp cầu")}
          className={inputClass}
        />
      </label>
      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error && t(state.error)}
      </p>
      <button disabled={pending} className={primaryButtonClass}>
        {t(pending ? "Đang lưu..." : submitLabel)}
      </button>
    </form>
  );
}

/**
 * "Thu tiền sân": pick a fixed member, tick any old unpaid months, and choose how many months to pay
 * from this month on. The amount is the sum of all those months.
 */
function MemberFeeFields({
  data,
  initialMemberId,
  initialFeeIds,
  initialMonths,
}: {
  data: MemberFeeData;
  initialMemberId: string;
  initialFeeIds: string[];
  initialMonths: number;
}) {
  const locale = useLocale();
  const t = translator(locale);
  const { members, settings, fromMonth } = data;
  const [memberId, setMemberId] = useState(members.some((m) => m.id === initialMemberId) ? initialMemberId : "");
  const [picked, setPicked] = useState(() => new Set(initialFeeIds));
  const member = members.find((m) => m.id === memberId);
  const [count, setCount] = useState(member?.canPayAhead ? initialMonths : 0);
  const debts = member ? oldDebts(member, fromMonth) : [];
  const ahead = member ? planPrepay(member, fromMonth, count, settings) : [];
  const total =
    debts.filter((f) => picked.has(f.id)).reduce((sum, f) => sum + f.amount, 0) +
    ahead.reduce((sum, m) => sum + m.amount, 0);

  if (members.length === 0) {
    return <p className="text-sm text-muted">{t("Chưa có thành viên cố định nào.")}</p>;
  }

  return (
    <>
      <label className={labelClass}>
        {t("Thành viên")}
        <select
          name="member_id"
          value={memberId}
          onChange={(e) => {
            const next = members.find((m) => m.id === e.target.value);
            setMemberId(e.target.value);
            setPicked(new Set());
            setCount(next?.canPayAhead ? 1 : 0);
          }}
          required
          className={selectClass}
        >
          <option value="" disabled>
            {t("Chọn thành viên cố định")}
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.canPayAhead ? "" : ` (${t("đã nghỉ")})`}
            </option>
          ))}
        </select>
      </label>
      {member && debts.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold text-muted">{t("Tháng cũ còn nợ")}</legend>
          {debts.map((f) => (
            <label
              key={f.id}
              className="flex h-11 cursor-pointer items-center gap-3 rounded-2xl border border-line-strong bg-surface px-4 text-sm has-checked:border-cta"
            >
              <input
                type="checkbox"
                name="fee_ids"
                value={f.id}
                checked={picked.has(f.id)}
                onChange={(e) => {
                  const next = new Set(picked);
                  if (e.target.checked) next.add(f.id);
                  else next.delete(f.id);
                  setPicked(next);
                }}
                className="size-4 accent-brand-600"
              />
              <span className="flex-1 font-semibold text-ink">{formatMonthLabel(f.month, locale)}</span>
              <span className="text-muted">{formatVnd(f.amount)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {member?.canPayAhead && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-muted">{t("Số tháng đóng, tính từ tháng này")}</span>
            <div className="flex items-center gap-1">
              <StepButton label={t("Bớt 1 tháng")} disabled={count <= 0} onClick={() => setCount(count - 1)}>
                −
              </StepButton>
              <input
                name="months"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_PREPAY_COUNT}
                value={count}
                onChange={(e) => setCount(Math.max(0, Math.min(MAX_PREPAY_COUNT, Math.trunc(Number(e.target.value) || 0))))}
                aria-label={t("Số tháng đóng")}
                className="h-10 w-14 rounded-2xl border border-line-strong bg-surface text-center font-bold"
              />
              <StepButton label={t("Thêm 1 tháng")} disabled={count >= MAX_PREPAY_COUNT} onClick={() => setCount(count + 1)}>
                +
              </StepButton>
            </div>
          </div>
          {ahead.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-2xl bg-surface-2 px-4 py-2 text-sm">
              {ahead.map((m) => (
                <li key={m.month} className="flex justify-between">
                  <span>{formatMonthLabel(m.month, locale)}</span>
                  <span className="text-muted">{formatVnd(m.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          {ahead.length > 0 && ahead[0].month !== fromMonth && (
            <p className="text-xs text-muted">{t("Tháng đã nộp hoặc tính theo buổi được bỏ qua.")}</p>
          )}
        </div>
      )}
      <div className={labelClass}>
        {t("Số tiền")}
        <p className="flex h-12 items-center rounded-2xl border border-line bg-surface-2 px-4 text-base font-bold text-ink">
          {formatVnd(total)}
        </p>
      </div>
    </>
  );
}

/** "Thu phí vãng lai": pick someone who owes for sessions and tick the sessions they pay for now. */
function GuestFeeFields({
  debtors,
  initialMemberId,
  initialIds,
}: {
  debtors: GuestDebtor[];
  initialMemberId: string;
  initialIds: string[];
}) {
  const t = useT();
  const [memberId, setMemberId] = useState(debtors.some((d) => d.memberId === initialMemberId) ? initialMemberId : "");
  const [picked, setPicked] = useState(() => new Set(initialIds));
  const debtor = debtors.find((d) => d.memberId === memberId);
  const total = debtor ? debtor.sessions.filter((s) => picked.has(s.id)).reduce((sum, s) => sum + s.amount, 0) : 0;

  if (debtors.length === 0) {
    return <p className="text-sm text-muted">{t("Không ai còn nợ tiền buổi.")}</p>;
  }

  return (
    <>
      <label className={labelClass}>
        {t("Người nộp")}
        <select
          name="member_id"
          value={memberId}
          onChange={(e) => {
            const next = debtors.find((d) => d.memberId === e.target.value);
            setMemberId(e.target.value);
            // Most people pay for everything they owe, so every session starts ticked.
            setPicked(new Set(next?.sessions.map((s) => s.id)));
          }}
          required
          className={selectClass}
        >
          <option value="" disabled>
            {t("Chọn người còn nợ tiền buổi")}
          </option>
          {debtors.map((d) => (
            <option key={d.memberId} value={d.memberId}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      {debtor && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold text-muted">{t("Buổi chưa nộp")}</legend>
          {debtor.sessions.map((s) => (
            <label
              key={s.id}
              className="flex h-11 cursor-pointer items-center gap-3 rounded-2xl border border-line-strong bg-surface px-4 text-sm has-checked:border-cta"
            >
              <input
                type="checkbox"
                name="attendance_ids"
                value={s.id}
                checked={picked.has(s.id)}
                onChange={(e) => {
                  const next = new Set(picked);
                  if (e.target.checked) next.add(s.id);
                  else next.delete(s.id);
                  setPicked(next);
                }}
                className="size-4 accent-brand-600"
              />
              <span className="flex-1 font-semibold text-ink">{t("Buổi {date}", { date: formatShortDate(s.date) })}</span>
              <span className="text-muted">{formatVnd(s.amount)}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className={labelClass}>
        {t("Số tiền")}
        <p className="flex h-12 items-center rounded-2xl border border-line bg-surface-2 px-4 text-base font-bold text-ink">
          {formatVnd(total)}
        </p>
      </div>
    </>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface text-lg font-bold disabled:opacity-40"
    >
      {children}
    </button>
  );
}
