import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateMember } from "@/app/actions/members";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { loadClub, todayInVietnam } from "@/lib/club";
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
      <p className="mt-6 text-center text-xs text-zinc-400">
        Lịch sử đi chơi và phí tháng sẽ hiện ở đây khi có màn Lịch.
      </p>
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
