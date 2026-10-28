import { Suspense } from "react";
import { NoClub } from "@/app/clubs/no-club";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { getPriceSettings, loadClub, todayInVietnam } from "@/lib/club";
import { loadDebtors } from "@/lib/debts";
import { priceUnpricedSlips, waiveFullMonthAbsences } from "@/lib/fees";
import { listBankIssues } from "@/lib/payments";
import { BankIssues } from "./bank-issues";
import { DebtList } from "./debt-list";

async function DebtsContent() {
  const { club } = await loadClub();
  if (!club) return <NoClub />;
  // Both have to finish first: a 0đ slip only shows as a debt once priced, and a Miễn slip is no debt.
  await Promise.all([
    getPriceSettings(club.id).then((s) => priceUnpricedSlips(club.id, s)),
    waiveFullMonthAbsences(club.id, todayInVietnam()),
  ]);
  const [debtors, issues] = await Promise.all([loadDebtors(club.id), listBankIssues(club.id)]);
  return (
    <>
      <BankIssues issues={issues} />
      <DebtList debtors={debtors} />
    </>
  );
}

export default function DebtsPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Người còn nợ" backHref="/" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <DebtsContent />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
