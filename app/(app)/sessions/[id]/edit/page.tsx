import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateSession } from "@/app/actions/schedule";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { Fresh } from "@/app/ui/fresh";
import { PageHeader } from "@/app/ui/page-header";
import { loadClub } from "@/lib/club";
import { listCourts } from "@/lib/courts";
import { formatTime } from "@/lib/dates";
import { getSession } from "@/lib/schedule";
import { SessionForm } from "../../../schedule/session-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function EditSession({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { userId, club } = await loadClub();
  if (!club) notFound();
  const [session, courts] = await Promise.all([getSession(club.id, id), listCourts(userId)]);
  if (!session) notFound();

  return (
    <div className="px-5 py-6">
      <Fresh>
        <SessionForm
          action={updateSession.bind(null, session.id)}
          submitLabel="Lưu"
          courts={courts}
          initialValues={{
            session_date: session.session_date,
            start_time: formatTime(session.start_time),
            end_time: formatTime(session.end_time),
            court_id: session.court_id ?? club.court_id ?? "",
            note: session.note ?? "",
          }}
        />
      </Fresh>
    </div>
  );
}

export default function EditSessionPage({ params }: PageProps<"/sessions/[id]/edit">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Sửa buổi" backHref="/schedule" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <EditSession params={params} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
