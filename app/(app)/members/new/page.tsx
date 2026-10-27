import { Suspense } from "react";
import { createMember } from "@/app/actions/members";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { Fresh } from "@/app/ui/fresh";
import { PageHeader } from "@/app/ui/page-header";
import { NoClub } from "@/app/clubs/no-club";
import { loadClub, todayInVietnam } from "@/lib/club";
import { MemberForm } from "../member-form";

async function NewMember() {
  const { club } = await loadClub();
  if (!club) return <NoClub />;
  return (
    <div className="px-5 py-6">
      <Fresh>
        <MemberForm
          action={createMember}
          submitLabel="Thêm thành viên"
          initialValues={{
            full_name: "",
            gender: "male",
            phone: "",
            member_type: "fixed",
            status: "active",
            fixed_since: todayInVietnam(),
            note: "",
          }}
        />
      </Fresh>
    </div>
  );
}

export default function NewMemberPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Thêm thành viên" backHref="/members" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <NewMember />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
