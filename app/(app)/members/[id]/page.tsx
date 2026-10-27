import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateMember } from "@/app/actions/members";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { formatVnd } from "@/lib/billing";
import { loadClub, todayInVietnam } from "@/lib/club";
import { formatDayLabel, formatMonthLabel } from "@/lib/dates";
import { loadMemberHistory } from "@/lib/member-history";
import { db } from "@/lib/supabase";
import { MemberForm } from "../member-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function MemberDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { club } = await loadClub();
  if (!club) notFound();

  const { data: m, error } = await db()
    .from("members")
    .select("id, full_name, gender, phone, member_type, status, fixed_since, note")
    .eq("id", id)
    .eq("club_id", club.id)
    .maybeSingle();
  if (error) throw error;
  if (!m) notFound();

  return (
    <div className="flex flex-col gap-6 px-5 pt-1 pb-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-brand-50 text-3xl font-bold text-brand-700">
          {m.full_name.trim().charAt(0).toUpperCase()}
        </span>
        <h2 className="text-[22px] font-bold tracking-tight">{m.full_name}</h2>
        <div className="flex flex-wrap justify-center gap-1.5 text-xs font-bold">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-700">
            {m.member_type === "fixed" ? "Cố định" : "Vãng lai"}
          </span>
          <span className="rounded-full bg-surface-2 px-3 py-1 text-muted">{m.gender === "male" ? "Nam" : "Nữ"}</span>
          <span className="rounded-full bg-surface-2 px-3 py-1 text-muted">
            {m.status === "active" ? "Đang chơi" : "Nghỉ"}
          </span>
        </div>
      </div>
      <MemberHistory memberId={m.id} />
      <section>
        <h2 className="section-title mb-2">Thông tin</h2>
        <div className="card p-4">
          <MemberForm
            action={updateMember.bind(null, m.id)}
            submitLabel="Lưu"
            showStatus
            today={todayInVietnam()}
            initialValues={{
              full_name: m.full_name,
              gender: m.gender,
              phone: m.phone ?? "",
              member_type: m.member_type,
              status: m.status,
              // A guest switched to fixed starts today unless changed.
              fixed_since: m.fixed_since ?? todayInVietnam(),
              note: m.note ?? "",
            }}
          />
        </div>
      </section>
    </div>
  );
}

const PAY_LABEL = { paid: "Đã nộp", unpaid: "Chưa nộp", exempt: "Miễn", waived: "Miễn" } as const;

async function MemberHistory({ memberId }: { memberId: string }) {
  const { visits, slips, owed } = await loadMemberHistory(memberId);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-muted">Số buổi đã đi</p>
          <p className="mt-1 text-lg font-bold tracking-tight">{visits.length} buổi</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Còn nợ</p>
          <p className={`mt-1 text-lg font-bold tracking-tight ${owed > 0 ? "text-red-600" : "text-brand-700"}`}>
            {formatVnd(owed)}
          </p>
        </div>
      </div>

      <section>
        <h2 className="section-title mb-2">Phí tháng</h2>
        {slips.length === 0 ? (
          <p className="text-sm text-muted">Chưa có phiếu.</p>
        ) : (
          <ul className="card divide-y divide-line px-4">
            {slips.slice(0, 6).map((s) => (
              <li key={s.id}>
                <Link href={`/fees?month=${s.month}`} className="flex items-center justify-between py-3 text-sm">
                  <span>{formatMonthLabel(s.month)}</span>
                  <span
                    className={
                      s.status === "unpaid" && s.billingMode === "monthly" ? "font-semibold text-red-600" : "text-muted"
                    }
                  >
                    {s.billingMode === "per_session"
                      ? "Tính theo buổi"
                      : `${formatVnd(s.amountDue)} · ${PAY_LABEL[s.status]}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="section-title mb-2">Các buổi đã đi</h2>
        {visits.length === 0 ? (
          <p className="text-sm text-muted">Chưa đi buổi nào.</p>
        ) : (
          <ul className="card divide-y divide-line px-4">
            {visits.slice(0, 10).map((v) => (
              <li key={v.attendanceId}>
                <Link href={`/sessions/${v.sessionId}`} className="flex items-center justify-between py-3 text-sm">
                  <span>{formatDayLabel(v.date)}</span>
                  <span
                    className={
                      v.chargeMode === "per_session" && v.paymentStatus === "unpaid"
                        ? "font-semibold text-red-600"
                        : "text-muted"
                    }
                  >
                    {v.chargeMode === "monthly"
                      ? "Phí tháng"
                      : `${formatVnd(v.amountDue)} · ${PAY_LABEL[v.paymentStatus]}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function MemberPage({ params }: PageProps<"/members/[id]">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Chi tiết thành viên" backHref="/members" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <MemberDetail params={params} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
