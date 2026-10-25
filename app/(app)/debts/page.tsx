import { Suspense } from "react";
import { NoClub } from "@/app/clubs/no-club";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { loadClub, todayInVietnam } from "@/lib/club";
import { loadDebtors } from "@/lib/debts";
import { waiveFullMonthAbsences } from "@/lib/fees";
import { DebtList } from "./debt-list";

async function DebtsContent() {
  const { club } = await loadClub();
  if (!club) return <NoClub />;
  await waiveFullMonthAbsences(club.id, todayInVietnam());
  return <DebtList debtors={await loadDebtors(club.id)} />;
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
