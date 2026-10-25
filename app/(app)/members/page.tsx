import Link from "next/link";
import { Suspense } from "react";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Fab } from "@/app/ui/fab";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { NoClub } from "@/app/clubs/no-club";
import { loadClub } from "@/lib/club";
import { db } from "@/lib/supabase";

const FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "fixed", label: "Cố định" },
  { key: "guest", label: "Vãng lai" },
  { key: "inactive", label: "Nghỉ" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

type MemberRow = {
  id: string;
  full_name: string;
  gender: "male" | "female";
  phone: string | null;
  member_type: "fixed" | "guest";
  status: "active" | "inactive";
};

function filterHref(filter: FilterKey, q: string) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `/members?${query}` : "/members";
}

async function MemberList({ searchParams }: { searchParams: PageProps<"/members">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const filter: FilterKey = FILTERS.some((f) => f.key === sp.filter) ? (sp.filter as FilterKey) : "all";
  const { club } = await loadClub();
  if (!club) return <NoClub />;

  let query = db()
    .from("members")
    .select("id, full_name, gender, phone, member_type, status")
    .eq("club_id", club.id)
    .order("full_name");
  // Fixed and Guest show people still playing; Nghỉ shows those who stopped.
  if (filter === "fixed" || filter === "guest") query = query.eq("member_type", filter).eq("status", "active");
  if (filter === "inactive") query = query.eq("status", "inactive");
  if (q) {
    // Strip characters that have meaning in PostgREST's or() syntax.
    const term = q.replace(/[,()*%\\]/g, " ");
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  const members = data as MemberRow[];

  return (
    <>
      <div className="flex flex-col gap-3 px-5 pb-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">{club.name}</p>
          <Link href="/fees" className="rounded-full bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700">
            Phí tháng ›
          </Link>
        </div>
        <form action="/members" className="flex gap-2">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Tìm theo tên hoặc số điện thoại"
            className="h-12 flex-1 rounded-full border border-line-strong bg-surface px-5 text-base outline-none focus:border-2 focus:border-brand-600"
          />
        </form>
        <nav className="flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={filterHref(f.key, q)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
                f.key === filter ? "border-cta bg-cta text-on-cta" : "border-line-strong bg-surface text-muted"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
      </div>

      {members.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">
          {q ? "Không tìm thấy ai." : filter === "all" ? "Chưa có thành viên. Bấm + để thêm." : "Không có ai trong mục này."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2 px-5">
          {members.map((m) => (
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

      <Fab href="/members/new" label="Thêm thành viên" />
    </>
  );
}

export default function MembersPage({ searchParams }: PageProps<"/members">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Thành viên" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <MemberList searchParams={searchParams} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
