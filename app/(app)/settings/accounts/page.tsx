import Link from "next/link";
import { Suspense } from "react";
import { primaryButtonClass } from "@/app/ui/form";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { formatLoginTime, listLinkCandidates, listOwnerAccounts } from "@/lib/account-links";
import { listClubs, requireUser } from "@/lib/club";
import { getT } from "@/lib/i18n/server";
import { AccountList } from "./account-forms";

// TK-7: member logins for every club of the owner in one place.
async function Accounts() {
  const clubs = await listClubs(await requireUser());
  const [accounts, candidates, t] = await Promise.all([listOwnerAccounts(clubs), listLinkCandidates(clubs), getT()]);
  return (
    <div className="flex flex-col gap-4 px-5 pt-1 pb-6">
      <Link href="/settings/accounts/new" className={`${primaryButtonClass} flex items-center justify-center`}>
        + {t("Tạo tài khoản")}
      </Link>
      <AccountList
        accounts={accounts.map((a) => ({
          id: a.id,
          loginId: a.loginId,
          passwordChanged: a.passwordChanged,
          lastLogin: a.lastLoginAt && formatLoginTime(a.lastLoginAt),
          members: a.members.map((m) => ({ name: m.name, clubName: m.clubName })),
        }))}
        without={candidates
          .filter((c) => !c.loginId)
          .map((c) => ({ memberId: c.memberId, name: c.name, clubName: c.clubName }))}
      />
    </div>
  );
}

export default function AccountsPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Tài khoản thành viên" backHref="/settings" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <Accounts />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
