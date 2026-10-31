import { Suspense } from "react";
import { createMember } from "@/app/actions/members";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { Fresh } from "@/app/ui/fresh";
import { PageHeader } from "@/app/ui/page-header";
import { NoClub } from "@/app/clubs/no-club";
import { listClubs, loadClub, todayInVietnam, type Club } from "@/lib/club";
import { memberCandidates, type CandidateRow } from "@/lib/member-candidates";
import { db } from "@/lib/supabase";
import { MemberForm } from "../member-form";

/** Every member row in the owner's clubs, for the "already in the app" picker. */
async function loadCandidates(clubs: Club[], clubId: string) {
  const { data, error } = await db()
    .from("members")
    .select("id, club_id, full_name, nickname, gender, phone, member_type, updated_at, account_members(account_id)")
    .in(
      "club_id",
      clubs.map((c) => c.id),
    );
  if (error) throw error;
  // account_members is keyed by member_id, so PostgREST returns one object; an array is handled too.
  type Row = Omit<CandidateRow, "club_name" | "account_id"> & {
    account_members: { account_id: string } | { account_id: string }[] | null;
  };
  const names = new Map(clubs.map((c) => [c.id, c.name]));
  const rows = (data as unknown as Row[]).map(({ account_members: link, ...m }) => ({
    ...m,
    club_name: names.get(m.club_id) ?? "",
    account_id: (Array.isArray(link) ? link[0]?.account_id : link?.account_id) ?? null,
  }));
  return memberCandidates(rows, clubId);
}

async function NewMember() {
  const { userId, club } = await loadClub();
  if (!club) return <NoClub />;
  const candidates = await loadCandidates(await listClubs(userId), club.id);
  return (
    <div className="px-5 py-6">
      <Fresh>
        <MemberForm
          action={createMember}
          submitLabel="Thêm thành viên"
          candidates={candidates}
          initialValues={{
            full_name: "",
            nickname: "",
            gender: "male",
            phone: "",
            member_type: "fixed",
            status: "active",
            fixed_since: todayInVietnam(),
            note: "",
          }}
        />
      </Fresh>
    </div>
  );
}

export default function NewMemberPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Thêm thành viên" backHref="/members" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <NewMember />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
