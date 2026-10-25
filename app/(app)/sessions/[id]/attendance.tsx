"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { addNewGuest, setLinePaid, setLinePrice, setPresence, type AttendanceResult } from "@/app/actions/attendance";
import { formatVnd, sessionTotals, type FeeStatus, type Gender } from "@/lib/billing";
import type { AttendanceView, GuestOption } from "@/lib/attendance";

type Lists = { fixed: AttendanceView[]; guests: AttendanceView[] };
type Change =
  | { kind: "presence"; memberId: string; present: boolean }
  | { kind: "paid"; attendanceId: string; paid: boolean }
  | { kind: "price"; attendanceId: string; amount: number }
  | { kind: "addGuest"; row: AttendanceView };

function applyChange(lists: Lists, change: Change): Lists {
  const map = (fn: (r: AttendanceView) => AttendanceView | null) => ({
    fixed: lists.fixed.map((r) => fn(r) ?? r),
    guests: lists.guests.flatMap((r) => {
      const next = fn(r);
      // A guest marked absent leaves the list.
      if (change.kind === "presence" && !change.present && r.memberId === change.memberId) return [];
      return [next ?? r];
    }),
  });
  switch (change.kind) {
    case "presence":
      return map((r) => (r.memberId === change.memberId ? { ...r, isPresent: change.present } : null));
    case "paid":
      return map((r) =>
        r.attendanceId === change.attendanceId ? { ...r, paymentStatus: change.paid ? "paid" : "unpaid" } : null,
      );
    case "price":
      return map((r) =>
        r.attendanceId === change.attendanceId ? { ...r, amountDue: change.amount, priceNote: "Sửa giá" } : null,
      );
    case "addGuest":
      return { ...lists, guests: [...lists.guests, change.row] };
  }
}

const FEE_LABEL: Record<FeeStatus, string> = { paid: "Đã nộp", unpaid: "Chưa nộp", waived: "Miễn" };
const GENDER_LABEL: Record<Gender, string> = { male: "Nam", female: "Nữ" };

type Props = Lists & {
  sessionId: string;
  readOnly: boolean;
  guestOptions: GuestOption[];
  guestPrices: Record<Gender, number>;
  feesHref: string;
};

export function Attendance({ sessionId, readOnly, fixed, guests, guestOptions, guestPrices, feesHref }: Props) {
  const [lists, applyOptimistic] = useOptimistic<Lists, Change>({ fixed, guests }, applyChange);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [addingGuest, setAddingGuest] = useState(false);

  function run(change: Change, action: () => Promise<AttendanceResult>) {
    setError(null);
    startTransition(async () => {
      applyOptimistic(change);
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  const togglePresence = (r: AttendanceView) =>
    run({ kind: "presence", memberId: r.memberId, present: !r.isPresent }, () =>
      setPresence(sessionId, r.memberId, !r.isPresent),
    );

  const totals = sessionTotals([...lists.fixed, ...lists.guests]);
  const presentFixed = lists.fixed.filter((r) => r.isPresent).length;

  return (
    <>
      <section className="mx-5 grid grid-cols-3 rounded-xl border border-zinc-200 p-3 text-center">
        <Total label="Phải thu" value={totals.due} />
        <Total label="Đã thu" value={totals.paid} />
        <Total label="Còn nợ" value={totals.outstanding} warn={totals.outstanding > 0} />
      </section>

      {error && (
        <p role="alert" className="mx-5 mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mx-5 mt-5 flex items-center justify-between">
        <h2 className="font-semibold">
          Cố định · {presentFixed}/{lists.fixed.length} có mặt
        </h2>
        <Link href={feesHref} className="text-sm font-semibold text-brand-700">
          Phí tháng ›
        </Link>
      </div>
      {lists.fixed.length === 0 && <p className="mx-5 mt-2 text-sm text-zinc-500">Chưa có thành viên cố định.</p>}
      <ul className="mx-5 divide-y divide-zinc-100">
        {lists.fixed.map((r) => (
          <li key={r.memberId} className="flex min-h-14 items-center gap-3 py-2">
            <PresenceButton row={r} disabled={readOnly} onToggle={() => togglePresence(r)} />
            <div className="min-w-0 flex-1">
              <p className={`truncate ${r.isPresent ? "" : "text-zinc-400"}`}>{r.name}</p>
              {r.chargeMode === "per_session" && (
                <p className="text-xs text-zinc-500">Vào giữa tháng, tính giá vãng lai</p>
              )}
            </div>
            {r.chargeMode === "monthly" ? (
              <span
                className={`text-xs font-semibold ${r.monthlyFee === "paid" ? "text-brand-700" : "text-amber-600"}`}
              >
                Tháng: {r.monthlyFee ? FEE_LABEL[r.monthlyFee] : "Chưa có phiếu"}
              </span>
            ) : (
              <ChargeControls
                row={r}
                disabled={readOnly || !r.isPresent || !r.attendanceId || pending}
                editing={r.attendanceId !== null && editingPrice === r.attendanceId}
                onEdit={() => setEditingPrice(r.attendanceId)}
                onCancelEdit={() => setEditingPrice(null)}
                onSavePrice={(input, amount) => {
                  setEditingPrice(null);
                  run({ kind: "price", attendanceId: r.attendanceId!, amount }, () =>
                    setLinePrice(sessionId, r.attendanceId!, input),
                  );
                }}
                onTogglePaid={() =>
                  run({ kind: "paid", attendanceId: r.attendanceId!, paid: r.paymentStatus !== "paid" }, () =>
                    setLinePaid(sessionId, r.attendanceId!, r.paymentStatus !== "paid"),
                  )
                }
              />
            )}
          </li>
        ))}
      </ul>

      <div className="mx-5 mt-6 flex items-center justify-between">
        <h2 className="font-semibold">Vãng lai · {lists.guests.length} người</h2>
        {!readOnly && (
          <button
            onClick={() => setAddingGuest(true)}
            className="h-10 rounded-lg border-2 border-brand-600 px-4 text-sm font-semibold text-brand-700"
          >
            + Khách
          </button>
        )}
      </div>
      {addingGuest && (
        <AddGuest
          options={guestOptions.filter((o) => !lists.guests.some((g) => g.memberId === o.id))}
          prices={guestPrices}
          onClose={() => setAddingGuest(false)}
          onPickExisting={(o) => {
            setAddingGuest(false);
            run({ kind: "addGuest", row: optimisticGuest(o.id, o.name, o.gender, guestPrices) }, () =>
              setPresence(sessionId, o.id, true),
            );
          }}
          onAddNew={(name, gender) => {
            setAddingGuest(false);
            run({ kind: "addGuest", row: optimisticGuest(`new-${name}`, name, gender, guestPrices) }, () =>
              addNewGuest(sessionId, name, gender),
            );
          }}
        />
      )}
      <ul className="mx-5 divide-y divide-zinc-100">
        {lists.guests.map((r) => (
          <li key={r.memberId} className="flex min-h-14 items-center gap-3 py-2">
            <PresenceButton row={r} disabled={readOnly || !r.attendanceId} onToggle={() => togglePresence(r)} />
            <div className="min-w-0 flex-1">
              <p className="truncate">
                {r.name} · {GENDER_LABEL[r.gender]}
              </p>
              {r.priceNote && <p className="text-xs text-zinc-500">{r.priceNote}</p>}
            </div>
            <ChargeControls
              row={r}
              disabled={readOnly || !r.attendanceId || pending}
              editing={r.attendanceId !== null && editingPrice === r.attendanceId}
              onEdit={() => setEditingPrice(r.attendanceId)}
              onCancelEdit={() => setEditingPrice(null)}
              onSavePrice={(input, amount) => {
                setEditingPrice(null);
                run({ kind: "price", attendanceId: r.attendanceId!, amount }, () =>
                  setLinePrice(sessionId, r.attendanceId!, input),
                );
              }}
              onTogglePaid={() =>
                run({ kind: "paid", attendanceId: r.attendanceId!, paid: r.paymentStatus !== "paid" }, () =>
                  setLinePaid(sessionId, r.attendanceId!, r.paymentStatus !== "paid"),
                )
              }
            />
          </li>
        ))}
      </ul>
      {!readOnly && lists.guests.length > 0 && (
        <p className="mx-5 mt-2 text-xs text-zinc-500">
          Bấm vào giá để sửa giá riêng. Bỏ dấu ✓ để xóa khách khỏi buổi.
        </p>
      )}
    </>
  );
}

function optimisticGuest(
  memberId: string,
  name: string,
  gender: Gender,
  prices: Record<Gender, number>,
): AttendanceView {
  return {
    memberId,
    name,
    gender,
    memberType: "guest",
    attendanceId: null,
    isPresent: true,
    chargeMode: "per_session",
    amountDue: prices[gender],
    paymentStatus: "unpaid",
    priceNote: null,
    monthlyFee: null,
  };
}

function Total({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`font-bold ${warn ? "text-amber-600" : ""}`}>{formatVnd(value)}</p>
    </div>
  );
}

function PresenceButton({ row, disabled, onToggle }: { row: AttendanceView; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={row.isPresent}
      aria-label={`${row.name}: ${row.isPresent ? "có mặt" : "vắng"}`}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full border-2 text-lg disabled:opacity-50 ${
        row.isPresent ? "border-brand-600 bg-brand-100 text-brand-700" : "border-zinc-300 text-transparent"
      }`}
    >
      ✓
    </button>
  );
}

function ChargeControls({
  row,
  disabled,
  editing,
  onEdit,
  onCancelEdit,
  onSavePrice,
  onTogglePaid,
}: {
  row: AttendanceView;
  disabled: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSavePrice: (input: string, amount: number) => void;
  onTogglePaid: () => void;
}) {
  const [draft, setDraft] = useState(formatVnd(row.amountDue).replace("đ", ""));

  if (editing) {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const amount = Number(draft.replace(/\D/g, "")) * (/k$/i.test(draft.trim()) ? 1000 : 1);
          onSavePrice(draft, amount);
        }}
      >
        <input
          autoFocus
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Giá buổi này"
          className="h-10 w-24 rounded-lg border border-zinc-300 px-2 text-right"
        />
        <button className="h-10 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white">Lưu</button>
        <button type="button" onClick={onCancelEdit} aria-label="Bỏ qua" className="h-10 px-2 text-zinc-500">
          ✕
        </button>
      </form>
    );
  }

  const paid = row.paymentStatus === "paid";
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onEdit}
        disabled={disabled}
        className="text-sm underline decoration-dotted underline-offset-4 disabled:no-underline"
      >
        {formatVnd(row.amountDue)}
      </button>
      <button
        onClick={onTogglePaid}
        disabled={disabled}
        className={`h-9 min-w-20 rounded-full border px-3 text-xs font-semibold disabled:opacity-40 ${
          paid ? "border-brand-600 bg-brand-100 text-brand-700" : "border-zinc-300 text-zinc-700"
        }`}
      >
        {paid ? "Đã nộp" : "Chưa nộp"}
      </button>
    </div>
  );
}

function AddGuest({
  options,
  prices,
  onClose,
  onPickExisting,
  onAddNew,
}: {
  options: GuestOption[];
  prices: Record<Gender, number>;
  onClose: () => void;
  onPickExisting: (option: GuestOption) => void;
  onAddNew: (name: string, gender: Gender) => void;
}) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const query = name.trim().toLowerCase();
  const matches = query ? options.filter((o) => o.name.toLowerCase().includes(query)).slice(0, 5) : options.slice(0, 5);

  return (
    <div className="mx-5 mt-3 flex flex-col gap-3 rounded-xl border border-brand-600 bg-brand-50 p-3">
      <input
        autoFocus
        placeholder="Tên khách (gõ để tìm người cũ)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-11 rounded-lg border border-zinc-300 bg-white px-3"
      />
      {matches.length > 0 && (
        <ul className="flex flex-col gap-1">
          {matches.map((o) => (
            <li key={o.id}>
              <button
                onClick={() => onPickExisting(o)}
                className="flex h-10 w-full items-center justify-between rounded-lg bg-white px-3 text-left text-sm"
              >
                <span>
                  {o.name} · {GENDER_LABEL[o.gender]}
                </span>
                <span className="text-brand-700">+ Thêm</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onAddNew(name.trim(), gender);
          }}
        >
          <p className="text-xs text-zinc-600">Hoặc thêm khách mới tên &quot;{name.trim()}&quot;:</p>
          <div className="grid grid-cols-2 gap-2">
            {(["male", "female"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={`h-11 rounded-lg border text-sm font-semibold ${
                  gender === g ? "border-brand-600 bg-white text-brand-700" : "border-zinc-300 text-zinc-600"
                }`}
              >
                {GENDER_LABEL[g]} · {formatVnd(prices[g])}
              </button>
            ))}
          </div>
          <button className="h-11 rounded-lg bg-brand-600 text-sm font-semibold text-white">Thêm khách mới</button>
        </form>
      )}
      <button onClick={onClose} className="h-10 text-sm text-zinc-600">
        Đóng
      </button>
    </div>
  );
}
