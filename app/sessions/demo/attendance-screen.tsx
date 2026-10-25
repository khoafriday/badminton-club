"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  defaultSessionCharge,
  formatVnd,
  guestPrice,
  sessionTotals,
  type ChargeMode,
  type FeeStatus,
  type Gender,
  type MemberForBilling,
  type PaymentStatus,
  type PriceSettings,
} from "@/lib/billing";

// Sample data for the prototype. The real screen will load these from Supabase.
const SESSION_DATE = "2026-10-27";
const SETTINGS: PriceSettings = {
  monthlyFeeMale: 300000,
  monthlyFeeFemale: 300000,
  guestPriceMale: 50000,
  guestPriceFemale: 40000,
};

type SampleMember = MemberForBilling & {
  id: string;
  name: string;
  present: boolean;
  paid: boolean;
  monthlyFee?: FeeStatus;
  customPrice?: number;
};

const SAMPLE_MEMBERS: SampleMember[] = [
  { id: "m1", name: "Anh Tuấn", gender: "male", memberType: "fixed", status: "active", fixedSince: "2026-01-01", present: true, paid: false, monthlyFee: "paid" },
  { id: "m2", name: "Chị Lan", gender: "female", memberType: "fixed", status: "active", fixedSince: "2026-03-01", present: true, paid: false, monthlyFee: "unpaid" },
  { id: "m3", name: "Minh", gender: "male", memberType: "fixed", status: "active", fixedSince: "2026-05-01", present: false, paid: false, monthlyFee: "paid" },
  { id: "m4", name: "Hùng", gender: "male", memberType: "fixed", status: "active", fixedSince: "2026-10-15", present: true, paid: false },
  { id: "g1", name: "Phong", gender: "male", memberType: "guest", status: "active", fixedSince: null, present: true, paid: true },
  { id: "g2", name: "Hà", gender: "female", memberType: "guest", status: "active", fixedSince: null, present: true, paid: false },
  { id: "g3", name: "Quân", gender: "male", memberType: "guest", status: "active", fixedSince: null, present: true, paid: true, customPrice: 45000 },
  { id: "g4", name: "Vy", gender: "female", memberType: "guest", status: "active", fixedSince: null, present: true, paid: true },
];

type Row = {
  id: string;
  name: string;
  gender: Gender;
  memberType: "fixed" | "guest";
  isPresent: boolean;
  chargeMode: ChargeMode;
  amountDue: number;
  paymentStatus: PaymentStatus;
  priceNote: string | null;
  monthlyFee: FeeStatus | null;
};

function toRow(m: SampleMember): Row {
  const charge = defaultSessionCharge(m, SESSION_DATE, SETTINGS);
  return {
    id: m.id,
    name: m.name,
    gender: m.gender,
    memberType: m.memberType,
    isPresent: m.present,
    chargeMode: charge.chargeMode,
    amountDue: m.customPrice ?? charge.amountDue,
    paymentStatus: m.paid ? "paid" : "unpaid",
    priceNote: m.customPrice ? "Giảm giá" : null,
    monthlyFee: m.monthlyFee ?? null,
  };
}

const GENDER_LABEL: Record<Gender, string> = { male: "Nam", female: "Nữ" };
const FEE_LABEL: Record<FeeStatus, string> = { paid: "Đã nộp", unpaid: "Chưa nộp", waived: "Miễn" };

export function AttendanceScreen() {
  const [rows, setRows] = useState<Row[]>(() => SAMPLE_MEMBERS.map(toRow));
  const [cancelled, setCancelled] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [addingGuest, setAddingGuest] = useState(false);

  const totals = useMemo(() => sessionTotals(rows), [rows]);
  const fixedRows = rows.filter((r) => r.memberType === "fixed");
  const guestRows = rows.filter((r) => r.memberType === "guest");
  const presentFixed = fixedRows.filter((r) => r.isPresent).length;

  function update(id: string, change: Partial<Row>) {
    setRows((current) => current.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }

  function addGuest(name: string, gender: Gender) {
    // TT-2: price fills in from the guest price for that gender; new guests start unpaid.
    setRows((current) => [
      ...current,
      {
        id: `new-${current.length + 1}`,
        name,
        gender,
        memberType: "guest",
        isPresent: true,
        chargeMode: "per_session",
        amountDue: guestPrice(SETTINGS, gender),
        paymentStatus: "unpaid",
        priceNote: null,
        monthlyFee: null,
      },
    ]);
    setAddingGuest(false);
  }

  return (
    <main className="flex flex-1 flex-col pb-8">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href="/" aria-label="Quay lại" className="flex size-10 items-center justify-center text-2xl">
            ‹
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Thứ 3, 27/10</h1>
            <p className="text-xs text-zinc-500">19:00 đến 21:00 · Sân Tân Bình</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              cancelled ? "bg-red-100 text-red-700" : "bg-brand-100 text-brand-700"
            }`}
          >
            {cancelled ? "Hủy" : "Active"}
          </span>
        </div>
      </header>

      <section className="mx-4 mt-4 grid grid-cols-3 rounded-xl border border-zinc-200 p-3 text-center">
        <Total label="Phải thu" value={totals.due} />
        <Total label="Đã thu" value={totals.paid} />
        <Total label="Còn nợ" value={totals.outstanding} warn={totals.outstanding > 0} />
      </section>

      <SectionTitle title={`Cố định · ${presentFixed}/${fixedRows.length} có mặt`} />
      <ul className="mx-4 divide-y divide-zinc-100">
        {fixedRows.map((row) => (
          <li key={row.id} className="flex min-h-14 items-center gap-3 py-2">
            <PresenceButton row={row} onToggle={() => update(row.id, { isPresent: !row.isPresent })} />
            <div className="flex-1">
              <p className={row.isPresent ? "" : "text-zinc-400"}>{row.name}</p>
              {row.chargeMode === "per_session" && (
                <p className="text-xs text-zinc-500">Vào giữa tháng, tính giá vãng lai</p>
              )}
            </div>
            {row.chargeMode === "monthly" ? (
              <span className={`text-sm font-semibold ${row.monthlyFee === "paid" ? "text-brand-700" : "text-amber-600"}`}>
                Tháng: {row.monthlyFee ? FEE_LABEL[row.monthlyFee] : "Chưa có phiếu"}
              </span>
            ) : (
              <ChargeControls
                row={row}
                editing={editingPriceId === row.id}
                onEdit={() => setEditingPriceId(row.id)}
                onSavePrice={(amount) => {
                  update(row.id, { amountDue: amount, priceNote: "Sửa tay" });
                  setEditingPriceId(null);
                }}
                onTogglePaid={() => update(row.id, { paymentStatus: row.paymentStatus === "paid" ? "unpaid" : "paid" })}
              />
            )}
          </li>
        ))}
      </ul>

      <div className="mx-4 mt-6 flex items-center justify-between">
        <h2 className="font-semibold">Vãng lai · {guestRows.length} người</h2>
        <button
          onClick={() => setAddingGuest(true)}
          className="h-10 rounded-lg border-2 border-brand-600 px-4 text-sm font-semibold text-brand-700"
        >
          + Khách
        </button>
      </div>
      {addingGuest && <AddGuestForm onAdd={addGuest} onCancel={() => setAddingGuest(false)} />}
      <ul className="mx-4 divide-y divide-zinc-100">
        {guestRows.map((row) => (
          <li key={row.id} className="flex min-h-14 items-center gap-3 py-2">
            <PresenceButton row={row} onToggle={() => update(row.id, { isPresent: !row.isPresent })} />
            <div className="flex-1">
              <p className={row.isPresent ? "" : "text-zinc-400"}>
                {row.name} · {GENDER_LABEL[row.gender]}
              </p>
              {row.priceNote && <p className="text-xs text-zinc-500">{row.priceNote}</p>}
            </div>
            <ChargeControls
              row={row}
              editing={editingPriceId === row.id}
              onEdit={() => setEditingPriceId(row.id)}
              onSavePrice={(amount) => {
                update(row.id, { amountDue: amount, priceNote: "Sửa tay" });
                setEditingPriceId(null);
              }}
              onTogglePaid={() => update(row.id, { paymentStatus: row.paymentStatus === "paid" ? "unpaid" : "paid" })}
            />
          </li>
        ))}
      </ul>

      <button
        onClick={() => setCancelled((c) => !c)}
        className="mx-4 mt-8 h-12 rounded-lg border border-zinc-300 text-sm font-semibold text-zinc-700"
      >
        {cancelled ? "Mở lại buổi (Active)" : "Hủy buổi"}
      </button>
      <p className="mx-4 mt-3 text-center text-xs text-zinc-400">Dữ liệu mẫu, tải lại trang sẽ về như cũ.</p>
    </main>
  );
}

function Total({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 font-bold ${warn ? "text-red-600" : ""}`}>{formatVnd(value)}</p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mx-4 mt-6 flex items-center justify-between">
      <h2 className="font-semibold">{title}</h2>
      <span className="text-xs text-zinc-500">Phí tháng</span>
    </div>
  );
}

function PresenceButton({ row, onToggle }: { row: Row; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={row.isPresent}
      aria-label={`${row.name}: ${row.isPresent ? "có mặt" : "vắng"}`}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full border-2 text-lg ${
        row.isPresent ? "border-brand-600 bg-brand-100 text-brand-700" : "border-zinc-300 text-transparent"
      }`}
    >
      ✓
    </button>
  );
}

function ChargeControls({
  row,
  editing,
  onEdit,
  onSavePrice,
  onTogglePaid,
}: {
  row: Row;
  editing: boolean;
  onEdit: () => void;
  onSavePrice: (amount: number) => void;
  onTogglePaid: () => void;
}) {
  const [draft, setDraft] = useState(String(row.amountDue));

  if (editing) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const amount = Number(draft.replace(/\D/g, ""));
          if (Number.isFinite(amount)) onSavePrice(amount);
        }}
      >
        <input
          autoFocus
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-10 w-24 rounded-lg border border-zinc-300 px-2 text-right"
        />
        <button className="h-10 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white">Lưu</button>
      </form>
    );
  }

  const paid = row.paymentStatus === "paid";
  return (
    <div className="flex items-center gap-2">
      <button onClick={onEdit} className="text-sm underline decoration-dotted underline-offset-4">
        {formatVnd(row.amountDue)}
      </button>
      <button
        onClick={onTogglePaid}
        disabled={!row.isPresent}
        className={`h-9 min-w-20 rounded-full border px-3 text-xs font-semibold disabled:opacity-40 ${
          paid ? "border-brand-600 bg-brand-100 text-brand-700" : "border-zinc-300 text-zinc-700"
        }`}
      >
        {paid ? "Đã nộp" : "Chưa nộp"}
      </button>
    </div>
  );
}

function AddGuestForm({ onAdd, onCancel }: { onAdd: (name: string, gender: Gender) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("male");

  return (
    <form
      className="mx-4 mt-3 flex flex-col gap-3 rounded-xl border border-brand-600 bg-brand-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onAdd(name.trim(), gender);
      }}
    >
      <input
        autoFocus
        placeholder="Tên khách"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-11 rounded-lg border border-zinc-300 bg-white px-3"
      />
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
            {GENDER_LABEL[g]} · {formatVnd(guestPrice(SETTINGS, g))}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="h-11 rounded-lg text-sm text-zinc-600">
          Bỏ qua
        </button>
        <button className="h-11 rounded-lg bg-brand-600 text-sm font-semibold text-white">Thêm</button>
      </div>
    </form>
  );
}
