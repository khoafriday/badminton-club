import Link from "next/link";
import { openPaymentQr } from "@/app/actions/payments";
import { primaryButtonClass } from "@/app/ui/form";
import { ClubSelect } from "@/app/ui/club-select";
import { ThemeToggle } from "@/app/ui/theme-toggle";
import { formatVnd } from "@/lib/billing";
import { getPriceSettings, todayInVietnam, type Viewer } from "@/lib/club";
import { listClubCourts } from "@/lib/courts";
import { WEEKDAY_LABEL, addDays, formatDayLabel, formatMonthLabel, formatTime } from "@/lib/dates";
import { ensureFeeSlips, waiveFullMonthAbsences } from "@/lib/fees";
import { loadMemberHistory } from "@/lib/member-history";
import { getBankAccount } from "@/lib/payments";
import { ensureSessions, listSchedules, listSessions } from "@/lib/schedule";

const FEE_LABEL = { paid: "Đã nộp", unpaid: "Chưa nộp", waived: "Miễn" } as const;

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`card mx-5 p-4 ${className}`}>{children}</section>;
}

/**
 * TK-4 Tổng quan for a member: their own money in the club (debt and what it is, this month's fee and visits,
 * months paid, total paid),
 * the coming sessions, its courts and its weekly times. Read only; the fund is on the Quỹ tab.
 */
export async function MemberHome({ viewer }: { viewer: Extract<Viewer, { kind: "member" }> }) {
  const { club, clubs, memberId, name } = viewer;
  const today = todayInVietnam();
  // The same jobs as the admin's Tổng quan, so this month's slip and the coming sessions exist.
  await Promise.all([
    getPriceSettings(club.id).then((s) => ensureFeeSlips(club.id, today, today, s)),
    ensureSessions(club.id, today),
    waiveFullMonthAbsences(club.id, today),
  ]);
  const [history, schedules, courts, sessions, bank] = await Promise.all([
    loadMemberHistory(memberId),
    listSchedules(club.id),
    listClubCourts(club.id),
    listSessions(club.id, today, addDays(today, 6)),
    getBankAccount(club.id),
  ]);
  const weekly = schedules.filter((s) => s.is_active);
  const month = today.slice(0, 7);
  const visitsThisMonth = history.visits.filter((v) => v.date.startsWith(month)).length;
  const slip = history.slips.find((s) => s.month === month);
  const thisMonthFee = !slip
    ? { label: "Chưa có phiếu", warn: false }
    : slip.billingMode === "per_session"
      ? { label: "Tính theo buổi", warn: false }
      : { label: FEE_LABEL[slip.status], warn: slip.status === "unpaid" };
  // What makes up the debt, oldest first: unpaid months, then unpaid sessions.
  const debts = [
    ...history.slips
      .filter((s) => s.billingMode === "monthly" && s.status === "unpaid" && s.amountDue > 0)
      .map((s) => ({
        key: s.id,
        date: `${s.month}-01`,
        label: `Phí ${formatMonthLabel(s.month).toLowerCase()}`,
        amount: s.amountDue,
      })),
    ...history.visits
      .filter((v) => v.chargeMode === "per_session" && v.paymentStatus === "unpaid" && v.amountDue > 0)
      .map((v) => ({
        key: v.attendanceId,
        date: v.date,
        label: `Buổi ${formatDayLabel(v.date)}`,
        amount: v.amountDue,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sessions.filter((s) => s.status === "active");

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex items-center gap-3 px-5 pt-3 pb-1">
        <span className="flex size-11 items-center justify-center rounded-full bg-cta text-xl" aria-hidden>
          🏸
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{formatDayLabel(today)}</p>
          <h1 className="sr-only">{club.name}</h1>
          {clubs.length > 1 ? (
            <ClubSelect clubs={clubs.map((c) => ({ id: c.id, name: c.name }))} currentId={club.id} variant="title" />
          ) : (
            <p className="truncate text-xl font-bold tracking-tight">{club.name}</p>
          )}
        </div>
        <ThemeToggle />
      </div>

      <div className="mx-5 mt-1">
        <h2 className="section-title">Của bạn · {name}</h2>
      </div>
      <Card className={history.owed > 0 ? "border-red-200 bg-red-50" : ""}>
        <p className="text-xs text-muted">Đang nợ</p>
        <p className={`mt-1 text-2xl font-bold tracking-tight ${history.owed > 0 ? "text-red-600" : "text-brand-700"}`}>
          {history.owed > 0 ? formatVnd(history.owed) : "Không nợ"}
        </p>
        {debts.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {debts.map((d) => (
              <li key={d.key} className="flex justify-between gap-3">
                <span>{d.label}</span>
                <span className="font-semibold text-red-600">{formatVnd(d.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        {/* QR chuyển khoản for the whole debt; shown once the club has an account to be paid into. */}
        {history.owed > 0 && bank && (
          <form action={openPaymentQr} className="mt-3">
            <button className={`${primaryButtonClass} w-full`}>Đóng tiền nợ {formatVnd(history.owed)}</button>
          </form>
        )}
      </Card>
      <div className="mx-5 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-muted">Phí tháng này</p>
          <p className={`mt-1 text-lg font-bold tracking-tight ${thisMonthFee.warn ? "text-red-600" : ""}`}>
            {thisMonthFee.label}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Buổi đã đi tháng này</p>
          <p className="mt-1 text-lg font-bold tracking-tight">{visitsThisMonth} buổi</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Đã đóng quỹ</p>
          <p className="mt-1 text-lg font-bold tracking-tight">{history.paidMonths} tháng</p>
        </div>
        <Link href="/history" className="card p-4">
          <p className="text-xs text-muted">Tổng đã đóng cho CLB</p>
          <p className="mt-1 text-lg font-bold tracking-tight text-brand-700">{formatVnd(history.paid)}</p>
          <p className="mt-1 text-xs font-bold text-brand-700">Lịch sử đóng phí ›</p>
        </Link>
      </div>

      <div className="mx-5 mt-2 flex items-center justify-between">
        <h2 className="section-title">Buổi sắp tới</h2>
        <Link href="/schedule" className="text-xs font-bold text-brand-700">
          Xem lịch ›
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Không có buổi nào trong 7 ngày tới.</p>
        </Card>
      ) : (
        <ul className="mx-5 flex flex-col gap-2">
          {upcoming.slice(0, 4).map((s) => (
            <li key={s.id} className="card px-4 py-3">
              <span className="block font-bold tracking-tight">
                {s.session_date === today ? "Hôm nay" : formatDayLabel(s.session_date)}
              </span>
              <span className="block text-xs text-muted">
                {formatTime(s.start_time)} đến {formatTime(s.end_time)} · {s.court_name ?? club.court_name ?? ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {courts.length > 0 && (
        <>
          <div className="mx-5 mt-2">
            <h2 className="section-title">Sân cầu</h2>
          </div>
          <ul className="mx-5 flex flex-col gap-2">
            {courts.map((c) => (
              <li key={c.id} className="card flex flex-col gap-0.5 px-4 py-3">
                <span className="font-bold tracking-tight">{c.name}</span>
                <span className="text-xs text-muted">{c.address ?? "Chưa có địa chỉ"}</span>
                {c.max_players && <span className="text-xs text-muted">Tối đa {c.max_players} người</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mx-5 mt-2">
        <h2 className="section-title">Lịch tập cố định</h2>
      </div>
      {weekly.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">CLB chưa có lịch cố định.</p>
        </Card>
      ) : (
        <ul className="mx-5 flex flex-col gap-2">
          {weekly.map((s) => (
            <li key={s.id} className="card flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-bold tracking-tight">{WEEKDAY_LABEL[s.weekday]} hằng tuần</span>
                <span className="block truncate text-xs text-muted">
                  {formatTime(s.start_time)} đến {formatTime(s.end_time)} · {s.court_name ?? club.court_name ?? ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
