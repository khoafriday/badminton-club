import { Suspense } from "react";
import { createSession } from "@/app/actions/schedule";
import { NoClub } from "@/app/clubs/no-club";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { Fresh } from "@/app/ui/fresh";
import { PageHeader } from "@/app/ui/page-header";
import { listClubs, loadClub, todayInVietnam } from "@/lib/club";
import { listCourts } from "@/lib/courts";
import { SessionForm } from "../session-form";

async function NewSession({ searchParams }: { searchParams: PageProps<"/schedule/new">["searchParams"] }) {
  const sp = await searchParams;
  const { userId, club } = await loadClub();
  if (!club) return <NoClub />;
  const [courts, clubs] = await Promise.all([listCourts(userId), listClubs(userId)]);
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayInVietnam();
  return (
    <div className="px-5 py-6">
      {/* key: the page is reused when opened again for another date, so the form must start over. */}
      <Fresh>
        <SessionForm
          key={date}
          action={createSession}
          submitLabel="Thêm buổi"
          courts={courts}
          clubs={clubs.map((c) => ({ id: c.id, name: c.name, court_id: c.court_id }))}
          initialValues={{
            club_id: club.id,
            session_date: date,
            start_time: "19:00",
            end_time: "21:00",
            court_id: club.court_id ?? "",
            note: "",
          }}
        />
      </Fresh>
    </div>
  );
}

export default function NewSessionPage({ searchParams }: PageProps<"/schedule/new">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Thêm buổi lẻ" backHref="/schedule" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <NewSession searchParams={searchParams} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
