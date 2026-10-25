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
    <div className="px-5 py-6">
      <MemberForm
        action={updateMember.bind(null, m.id)}
        submitLabel="Lưu"
        showStatus
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
      <MemberHistory memberId={m.id} />
    </div>
  );
}

const PAY_LABEL = { paid: "Đã nộp", unpaid: "Chưa nộp", exempt: "Miễn", waived: "Miễn" } as const;

async function MemberHistory({ memberId }: { memberId: string }) {
  const { visits, slips, owed } = await loadMemberHistory(memberId);
  return (
    <div className="mt-8 flex flex-col gap-6">
      <div className={`rounded-xl p-4 ${owed > 0 ? "bg-amber-50 text-amber-800" : "bg-brand-50 text-brand-700"}`}>
        <p className="text-sm">Còn nợ</p>
        <p className="text-xl font-bold">{formatVnd(owed)}</p>
      </div>

      <section>
        <h2 className="mb-2 font-bold">Phí tháng</h2>
        {slips.length === 0 ? (
          <p className="text-sm text-zinc-500">Chưa có phiếu.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {slips.slice(0, 6).map((s) => (
              <li key={s.id}>
                <Link href={`/fees?month=${s.month}`} className="flex items-center justify-between py-2 text-sm">
                  <span>{formatMonthLabel(s.month)}</span>
                  <span
                    className={
                      s.status === "unpaid" && s.billingMode === "monthly" ? "text-amber-600" : "text-zinc-600"
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
        <h2 className="mb-2 font-bold">Các buổi đã đi · {visits.length}</h2>
        {visits.length === 0 ? (
          <p className="text-sm text-zinc-500">Chưa đi buổi nào.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {visits.slice(0, 10).map((v) => (
              <li key={v.attendanceId}>
                <Link href={`/sessions/${v.sessionId}`} className="flex items-center justify-between py-2 text-sm">
                  <span>{formatDayLabel(v.date)}</span>
                  <span
                    className={
                      v.chargeMode === "per_session" && v.paymentStatus === "unpaid"
                        ? "text-amber-600"
                        : "text-zinc-600"
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
