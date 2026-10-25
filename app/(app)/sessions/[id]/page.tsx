import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { setSessionCancelled } from "@/app/actions/schedule";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { loadClub } from "@/lib/club";
import { formatDayLabel, formatTime } from "@/lib/dates";
import { getSession, sessionsWithData } from "@/lib/schedule";
import { CancelSessionForm, DeleteSessionButton } from "./session-actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { club } = await loadClub();
  if (!club) notFound();
  const session = await getSession(club.id, id);
  if (!session) notFound();
  const hasData = (await sessionsWithData([session.id])).size > 0;
  const cancelled = session.status === "cancelled";

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-lg font-bold ${cancelled ? "text-zinc-400 line-through" : ""}`}>
            {formatDayLabel(session.session_date)}
          </p>
          <p className="text-sm text-zinc-600">
            {formatTime(session.start_time)} đến {formatTime(session.end_time)} ·{" "}
            {session.venue_name ?? club.venue_name ?? "Chưa có sân"}
          </p>
          {session.note && <p className="mt-1 text-sm text-zinc-500">{session.note}</p>}
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            cancelled ? "bg-red-100 text-red-700" : "bg-brand-100 text-brand-700"
          }`}
        >
          {cancelled ? "Hủy" : "Active"}
        </span>
      </div>
      {cancelled && session.cancel_reason && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Lý do hủy: {session.cancel_reason}</p>
      )}

      <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-500">Điểm danh và thu tiền buổi này sẽ có ở bản tới.</p>

      <div className="flex flex-col gap-2">
        <Link
          href={`/sessions/${session.id}/edit`}
          className="flex h-11 items-center justify-center rounded-lg border-2 border-brand-600 text-sm font-semibold text-brand-700"
        >
          Sửa ngày, giờ, sân
        </Link>
        {cancelled ? (
          <form action={setSessionCancelled.bind(null, session.id, false)}>
            <button className="h-11 w-full rounded-lg border border-brand-600 text-sm font-semibold text-brand-700">
              Khôi phục buổi (Active)
            </button>
          </form>
        ) : (
          <CancelSessionForm sessionId={session.id} />
        )}
        {/* LICH-7: a session with attendance or money can only be cancelled. */}
        {!hasData && <DeleteSessionButton sessionId={session.id} />}
      </div>
    </div>
  );
}

export default function SessionPage({ params }: PageProps<"/sessions/[id]">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Buổi tập" backHref="/schedule" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <SessionDetail params={params} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
