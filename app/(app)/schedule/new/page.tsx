import { Suspense } from "react";
import { createSession } from "@/app/actions/schedule";
import { NoClub } from "@/app/clubs/no-club";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { loadClub, todayInVietnam } from "@/lib/club";
import { SessionForm } from "../session-form";

async function NewSession({ searchParams }: { searchParams: PageProps<"/schedule/new">["searchParams"] }) {
  const sp = await searchParams;
  const { club } = await loadClub();
  if (!club) return <NoClub />;
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayInVietnam();
  return (
    <div className="px-5 py-6">
      <SessionForm
        action={createSession}
        submitLabel="Thêm buổi"
        venuePlaceholder={club.court_name ?? ""}
        initialValues={{ session_date: date, start_time: "19:00", end_time: "21:00", venue_name: "", note: "" }}
      />
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
