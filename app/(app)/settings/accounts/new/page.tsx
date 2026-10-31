import { Suspense } from "react";
import { Fresh } from "@/app/ui/fresh";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { listLinkCandidates } from "@/lib/account-links";
import { listClubs, requireUser } from "@/lib/club";
import { CreateAccountForm } from "../account-forms";

async function NewAccount({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const memberId = typeof sp.member === "string" ? sp.member : "";
  const clubs = await listClubs(await requireUser());
  const all = await listLinkCandidates(clubs);
  // Opened from a member: they are picked, and members with the same name come first.
  const first = all.find((c) => c.memberId === memberId);
  const candidates = first ? await listLinkCandidates(clubs, first.name) : all;
  return (
    <div className="card m-5 mt-1 p-4">
      <Fresh>
        <CreateAccountForm key={memberId} candidates={candidates} preselect={first ? [first.memberId] : []} />
      </Fresh>
    </div>
  );
}

export default function NewAccountPage({ searchParams }: PageProps<"/settings/accounts/new">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Tạo tài khoản" backHref="/settings/accounts" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <NewAccount searchParams={searchParams} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
