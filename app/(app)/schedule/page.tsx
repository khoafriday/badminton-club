import Link from "next/link";
import { Suspense } from "react";
import { NoClub } from "@/app/clubs/no-club";
import { ClubPicker } from "@/app/ui/club-picker";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Fab } from "@/app/ui/fab";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { SwitchClubLink } from "@/app/ui/switch-club-link";
import { listClubs, loadViewer, todayInVietnam, type Club } from "@/lib/club";
import {
  addDays,
  addMonths,
  formatDayLabel,
  formatMonthLabel,
  formatShortDate,
  formatTime,
  mondayOf,
} from "@/lib/dates";
import { monthEnd } from "@/lib/billing";
import { translator, type T } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { ensureSessions, listSessions, listUpcomingSessions, type SessionRow } from "@/lib/schedule";

type View = "week" | "month" | "all";
type ListedSession = SessionRow & { club_id: string };
const VIEW_LABEL: Record<View, string> = {
  week: "Tuần",
  month: "Tháng",
  all: "Tất cả",
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function scheduleHref(view: View, date: string) {
  if (view === "all") return "/schedule?view=all";
  return view === "week" ? `/schedule?date=${date}` : `/schedule?view=month&date=${date}`;
}

async function ScheduleContent({ searchParams }: { searchParams: PageProps<"/schedule">["searchParams"] }) {
  const [sp, viewer, locale] = await Promise.all([searchParams, loadViewer(), getLocale()]);
  const t = translator(locale);
  const { club } = viewer;
  if (!club) return <NoClub />;
  // A member sees the sessions of all their clubs, without links into admin screens.
  const admin = viewer.kind === "admin";

  const today = todayInVietnam();
  const view: View = sp.view === "month" || (sp.view === "all" && admin) ? sp.view : "week";
  const anchor = typeof sp.date === "string" && ISO_DATE.test(sp.date) ? sp.date : today;

  let sessions: ListedSession[];
  let scheduleCount: number;
  let clubs: Club[] = [club];
  let period: {
    label: string;
    from: string;
    to: string;
    prev: string;
    next: string;
  } | null = null;
  if (view === "all") {
    // Every upcoming session of every club this login manages.
    clubs = viewer.kind === "admin" ? await listClubs(viewer.userId) : [club];
    const counts = await Promise.all(clubs.map((c) => ensureSessions(c.id, today)));
    scheduleCount = counts.reduce((sum, c) => sum + c.scheduleCount, 0);
    sessions = await listUpcomingSessions(
      clubs.map((c) => c.id),
      today,
    );
  } else {
    if (view === "week") {
      const from = mondayOf(anchor);
      const to = addDays(from, 6);
      period = {
        from,
        to,
        label: `${formatShortDate(from)} ${t("đến")} ${formatShortDate(to)}`,
        prev: addDays(from, -7),
        next: addDays(from, 7),
      };
    } else {
      const month = anchor.slice(0, 7);
      const from = `${month}-01`;
      period = {
        from,
        to: monthEnd(from),
        label: formatMonthLabel(month, locale),
        prev: `${addMonths(month, -1)}-01`,
        next: `${addMonths(month, 1)}-01`,
      };
    }
    if (viewer.kind === "member") {
      // A member sees the sessions of every club they play in.
      clubs = viewer.clubs;
      const counts = await Promise.all(clubs.map((c) => ensureSessions(c.id, today)));
      scheduleCount = counts.reduce((sum, c) => sum + c.scheduleCount, 0);
      sessions = await listUpcomingSessions(
        clubs.map((c) => c.id),
        period.from,
        period.to,
      );
    } else {
      ({ scheduleCount } = await ensureSessions(club.id, today));
      sessions = (await listSessions(club.id, period.from, period.to)).map((s) => ({ ...s, club_id: club.id }));
    }
  }
  const clubById = new Map(clubs.map((c) => [c.id, c]));
  const byDate = new Map<string, ListedSession[]>();
  for (const s of sessions) byDate.set(s.session_date, [...(byDate.get(s.session_date) ?? []), s]);
  const emptyText = {
    week: "Không có buổi nào trong tuần này.",
    month: "Không có buổi nào trong tháng này.",
    all: "Không có buổi nào sắp tới.",
  }[view];

  return (
    <>
      <div className="flex flex-col gap-3 px-5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex rounded-full bg-surface-2 p-1 text-sm font-semibold">
            {(admin ? (["week", "month", "all"] as const) : (["week", "month"] as const)).map((v) => (
              <Link
                key={v}
                href={scheduleHref(v, anchor)}
                className={`rounded-full px-4 py-2 ${v === view ? "bg-surface text-ink shadow-card" : "text-muted"}`}
              >
                {t(VIEW_LABEL[v])}
              </Link>
            ))}
          </div>
          {admin && (
            <Link
              href="/schedule/weekly"
              className="shrink-0 rounded-full bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700"
            >
              {t("Lịch cố định")} ›
            </Link>
          )}
        </div>
        {period ? (
          <div className="card flex items-center justify-between px-2 py-1">
            <Link
              href={scheduleHref(view, period.prev)}
              aria-label={t("Trước")}
              className="flex size-10 items-center justify-center text-2xl"
            >
              ‹
            </Link>
            <div className="text-center">
              <p className="font-bold">{period.label}</p>
              {(today < period.from || today > period.to) && (
                <Link href={scheduleHref(view, today)} className="text-xs text-brand-700">
                  {t("Về hôm nay")}
                </Link>
              )}
            </div>
            <Link
              href={scheduleHref(view, period.next)}
              aria-label={t("Sau")}
              className="flex size-10 items-center justify-center text-2xl"
            >
              ›
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted">
            {clubs.length > 1
              ? t("Các buổi từ hôm nay của cả {count} CLB bạn quản lý.", { count: clubs.length })
              : t("Các buổi từ hôm nay của CLB bạn quản lý.")}
          </p>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted">
          <p>{t(emptyText)}</p>
          {admin && scheduleCount === 0 && (
            <p className="mt-1">
              {t("Tạo")}{" "}
              <Link href="/schedule/weekly" className="font-semibold text-brand-700">
                {t("lịch cố định")}
              </Link>{" "}
              {t("để app tự tạo buổi, hoặc bấm + để thêm buổi lẻ.")}
            </p>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2 px-5">
          {[...byDate].map(([date, daySessions]) => (
            <li key={date} className="flex gap-3">
              <p
                className={`w-12 shrink-0 pt-2.5 text-center ${date === today ? "text-brand-700" : "text-muted"}`}
                aria-label={formatDayLabel(date, locale)}
              >
                <span className="block text-xl leading-tight font-bold tracking-tight">{date.slice(8, 10)}</span>
                <span className="block text-[10px] font-bold uppercase">{formatDayLabel(date, locale).split(",")[0]}</span>
                {view === "all" && (
                  <span className="block text-[10px]">
                    {locale === "en" ? formatMonthLabel(date.slice(0, 7), "en").slice(0, 3) : `Th${Number(date.slice(5, 7))}`}
                  </span>
                )}
              </p>
              <ul className="flex min-w-0 flex-1 flex-col gap-2">
                {daySessions.map((s) => (
                  <li key={s.id}>
                    <SessionCard
                      session={s}
                      club={clubById.get(s.club_id) ?? club}
                      isCurrentClub={s.club_id === club.id}
                      today={today}
                      readOnly={!admin}
                      t={t}
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {admin && <Fab href={`/schedule/new?date=${anchor < today ? today : anchor}`} label={t("Thêm buổi lẻ")} />}
    </>
  );
}

/** One session. Shows its club, since the "Tất cả" list mixes clubs. */
function SessionCard({
  session: s,
  club,
  isCurrentClub,
  today,
  readOnly,
  t,
}: {
  session: ListedSession;
  club: Club;
  isCurrentClub: boolean;
  today: string;
  /** A member's view: the card opens nothing. */
  readOnly: boolean;
  t: T;
}) {
  const className = "card flex items-center gap-3 px-4 py-3 active:bg-surface-2";
  const content = (
    <>
      <span className={`min-w-0 flex-1 ${s.status === "cancelled" ? "text-faint line-through" : ""}`}>
        <span className="font-bold">
          {formatTime(s.start_time)} {t("đến")} {formatTime(s.end_time)}
        </span>
        <span className="block truncate text-xs font-semibold text-brand-700">{club.name}</span>
        <span className="block truncate text-xs text-muted">
          {s.court_name ?? club.court_name ?? t("Chưa có sân")}
          {s.schedule_id ? "" : ` · ${t("Buổi lẻ")}`}
        </span>
      </span>
      {s.status === "cancelled" ? (
        <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600">{t("Hủy")}</span>
      ) : (
        s.session_date === today && (
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">{t("Hôm nay")}</span>
        )
      )}
    </>
  );
  const href = `/sessions/${s.id}`;
  if (readOnly) return <div className="card flex items-center gap-3 px-4 py-3">{content}</div>;
  return isCurrentClub ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <SwitchClubLink clubId={s.club_id} href={href} className={className}>
      {content}
    </SwitchClubLink>
  );
}

export default function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        title="Lịch"
        right={
          <Suspense>
            <ClubPicker adminOnly />
          </Suspense>
        }
      />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <ScheduleContent searchParams={searchParams} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
