"use client";

import { useDeferredValue, useState } from "react";
import { inputClass } from "@/app/ui/form";
import { useT } from "@/app/ui/locale";
import { searchCandidates, type Candidate } from "@/lib/member-candidates";

/**
 * Searchable list of people already in the app (other clubs, or guests here). The pick is sent as
 * source_member_id; MemberForm hides the new-member fields while someone is picked.
 */
export function MemberPicker({
  candidates,
  picked,
  onPick,
}: {
  candidates: Candidate[];
  picked: Candidate | null;
  onPick: (c: Candidate | null) => void;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const shown = searchCandidates(candidates, useDeferredValue(q));

  if (picked) {
    return (
      <div className="card flex items-center gap-3 px-3 py-2.5">
        <input type="hidden" name="source_member_id" value={picked.id} />
        <CandidateLine c={picked} />
        <button
          type="button"
          onClick={() => onPick(null)}
          aria-label={t("Bỏ chọn")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-xl text-muted active:bg-surface-2"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls="member-picker-list"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder={t("Tìm theo tên, biệt danh hoặc số điện thoại")}
        className={inputClass}
      />
      {open && (
        <ul
          id="member-picker-list"
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-line-strong bg-surface py-1 shadow-lg"
        >
          {shown.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">{t("Không tìm thấy ai.")}</li>
          ) : (
            shown.map((c) => (
              <li
                key={c.id}
                role="option"
                aria-selected={false}
                // mousedown, not click: the input's blur would close the list before the click lands.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(c);
                  setQ("");
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 active:bg-surface-2"
              >
                <CandidateLine c={c} />
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function CandidateLine({ c }: { c: Candidate }) {
  const t = useT();
  const where = [...c.clubs, ...(c.guestHere ? [t("Vãng lai ở CLB này")] : [])].join(", ");
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate font-semibold text-ink">
        {c.full_name}
        {c.nickname && <span className="font-normal text-muted"> ({c.nickname})</span>}
      </span>
      <span className="truncate text-xs text-muted">
        {t(c.gender === "male" ? "Nam" : "Nữ")}
        {c.phone ? ` · ${c.phone}` : ""}
        {where ? ` · ${where}` : ""}
      </span>
    </span>
  );
}
