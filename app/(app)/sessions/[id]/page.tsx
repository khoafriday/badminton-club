import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { setSessionCancelled } from "@/app/actions/schedule";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { loadAttendance } from "@/lib/attendance";
import { getPriceSettings, loadClub, todayInVietnam } from "@/lib/club";
import { ensureFeeSlips } from "@/lib/fees";
import { formatDayLabel, formatTime } from "@/lib/dates";
import { getSession, sessionsWithData } from "@/lib/schedule";
import { Attendance } from "./attendance";
import { CancelSessionForm, DeleteSessionButton } from "./session-actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { club } = await loadClub();
  if (!club) notFound();
  const [session, settings] = await Promise.all([getSession(club.id, id), getPriceSettings(club.id)]);
  if (!session) notFound();
  const cancelled = session.status === "cancelled";
  await ensureFeeSlips(club.id, session.session_date, todayInVietnam(), settings);
  const [lists, used] = await Promise.all([loadAttendance(club.id, session, settings), sessionsWithData([session.id])]);
  const hasData = used.size > 0;

  return (
    <>
      <div className="flex flex-col gap-3 px-5 pt-1 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-[22px] font-bold tracking-tight ${cancelled ? "text-faint line-through" : ""}`}>
              {formatDayLabel(session.session_date)}
            </p>
            <p className="text-sm text-muted">
              {formatTime(session.start_time)} đến {formatTime(session.end_time)} ·{" "}
              {session.court_name ?? club.court_name ?? "Chưa có sân"}
            </p>
            {session.note && <p className="mt-1 text-sm text-muted">{session.note}</p>}
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
          <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">Lý do hủy: {session.cancel_reason}</p>
        )}
      </div>

      <Attendance
        sessionId={session.id}
        readOnly={cancelled}
        fixed={lists.fixed}
        guests={lists.guests}
        guestOptions={lists.guestOptions}
        guestPrices={{ male: settings.guestPriceMale, female: settings.guestPriceFemale }}
        feesHref={`/fees?month=${session.session_date.slice(0, 7)}`}
        maxPlayers={session.court_id ? session.court_max_players : club.court_max_players}
      />

      <details className="card mx-5 mt-8">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-muted">
          Quản lý buổi: sửa, hủy, xóa
        </summary>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <Link
            href={`/sessions/${session.id}/edit`}
            className="flex h-11 items-center justify-center rounded-full bg-cta text-sm font-semibold text-on-cta"
          >
            Sửa ngày, giờ, sân
          </Link>
          {cancelled ? (
            <form action={setSessionCancelled.bind(null, session.id, false)}>
              <button className="h-11 w-full rounded-full border border-brand-600 text-sm font-semibold text-brand-700">
                Khôi phục buổi (Active)
              </button>
            </form>
          ) : (
            <CancelSessionForm sessionId={session.id} />
          )}
          {/* LICH-7: a session with attendance or money can only be cancelled. */}
          {!hasData && <DeleteSessionButton sessionId={session.id} />}
        </div>
      </details>
    </>
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
