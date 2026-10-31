import Link from "next/link";
import { Suspense } from "react";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Fab } from "@/app/ui/fab";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { NoClub } from "@/app/clubs/no-club";
import { ClubPicker } from "@/app/ui/club-picker";
import { loadClub } from "@/lib/club";
import { getT } from "@/lib/i18n/server";
import { parseMemberFilter, type MemberRow } from "@/lib/member-filter";
import { db } from "@/lib/supabase";
import { MemberList } from "./member-list";

async function Members({ searchParams }: { searchParams: PageProps<"/members">["searchParams"] }) {
  const [sp, { club }, t] = await Promise.all([searchParams, loadClub(), getT()]);
  if (!club) return <NoClub />;

  // One query for everyone; the list filters in the browser, so changing a filter does not reload.
  // Guests belong to the sessions they came to, not to the club: they stay in the database and
  // only come back as suggestions when adding a guest to a session.
  const { data, error } = await db()
    .from("members")
    .select("id, full_name, nickname, gender, phone, member_type, status")
    .eq("club_id", club.id)
    .eq("member_type", "fixed")
    .order("full_name");
  if (error) throw error;

  return (
    <>
      <div className="flex items-center justify-end px-5 pb-3">
        <Link href="/fees" className="rounded-full bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700">
          {t("Phí tháng")} ›
        </Link>
      </div>
      <MemberList
        members={data as MemberRow[]}
        initialFilter={parseMemberFilter(sp.filter)}
        initialQ={typeof sp.q === "string" ? sp.q.trim() : ""}
      />
      <Fab href="/members/new" label={t("Thêm thành viên")} />
    </>
  );
}

export default function MembersPage({ searchParams }: PageProps<"/members">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        title="Thành viên"
        right={
          <Suspense>
            <ClubPicker />
          </Suspense>
        }
      />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <Members searchParams={searchParams} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
