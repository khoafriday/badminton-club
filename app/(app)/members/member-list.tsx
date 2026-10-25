"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { filterMembers, MEMBER_FILTERS, type MemberFilter, type MemberRow } from "@/lib/member-filter";

// Keeps the choice in the address bar so Back and a shared link land on the same view, without a server trip.
function syncUrl(filter: MemberFilter, q: string) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (q.trim()) params.set("q", q.trim());
  const query = params.toString();
  window.history.replaceState(null, "", query ? `/members?${query}` : "/members");
}

/** The whole list is loaded once; searching and filtering happen here in the browser. */
export function MemberList({
  members,
  initialFilter,
  initialQ,
}: {
  members: MemberRow[];
  initialFilter: MemberFilter;
  initialQ: string;
}) {
  const [filter, setFilter] = useState(initialFilter);
  const [q, setQ] = useState(initialQ);
  const shown = filterMembers(members, filter, useDeferredValue(q));

  return (
    <>
      <div className="flex flex-col gap-3 px-5 pb-3">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            syncUrl(filter, e.target.value);
          }}
          placeholder="Tìm theo tên hoặc số điện thoại"
          className="h-12 rounded-full border border-line-strong bg-surface px-5 text-base outline-none focus:border-2 focus:border-brand-600"
        />
        <nav className="flex gap-2 overflow-x-auto">
          {MEMBER_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={f.key === filter}
              onClick={() => {
                setFilter(f.key);
                syncUrl(f.key, q);
              }}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
                f.key === filter ? "border-cta bg-cta text-on-cta" : "border-line-strong bg-surface text-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </nav>
      </div>

      {shown.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">
          {q.trim()
            ? "Không tìm thấy ai."
            : filter === "all"
              ? "Chưa có thành viên. Bấm + để thêm."
              : "Không có ai trong mục này."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2 px-5">
          {shown.map((m) => (
            <li key={m.id}>
              <Link href={`/members/${m.id}`} className="card flex items-center gap-3 px-3 py-2.5 active:bg-surface-2">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700">
                  {m.full_name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{m.full_name}</span>
                  <span className="text-xs text-muted">
                    {m.member_type === "fixed" ? "Cố định" : "Vãng lai"} · {m.gender === "male" ? "Nam" : "Nữ"}
                    {m.phone ? ` · ${m.phone}` : ""}
                  </span>
                </span>
                {m.status === "inactive" && (
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted">Nghỉ</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
