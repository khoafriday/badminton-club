import { Suspense } from "react";
import { createTransaction } from "@/app/actions/fund";
import { NoClub } from "@/app/clubs/no-club";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { Fresh } from "@/app/ui/fresh";
import { PageHeader } from "@/app/ui/page-header";
import { getPriceSettings, loadClub, todayInVietnam } from "@/lib/club";
import { listPrepayMembers, priceUnpricedSlips } from "@/lib/fees";
import { guestDebtors, loadDebtors } from "@/lib/debts";
import { listCategories } from "@/lib/fund";
import { ClubBadge, TxForm } from "../tx-form";

async function NewTx({ searchParams }: { searchParams: PageProps<"/fund/new">["searchParams"] }) {
  const sp = await searchParams;
  const { club } = await loadClub();
  if (!club) return <NoClub />;
  const thisMonth = todayInVietnam().slice(0, 7);
  const [categories, debtors, { settings, members }] = await Promise.all([
    listCategories(club.id),
    loadDebtors(club.id),
    getPriceSettings(club.id).then(async (settings) => {
      await priceUnpricedSlips(club.id, settings);
      return { settings, members: await listPrepayMembers(club.id, thisMonth) };
    }),
  ]);
  const type = sp.type === "income" ? "income" : "expense";
  return (
    <div className="flex flex-col gap-4 px-5 py-6">
      <ClubBadge name={club.name} />
      {/* key: opening "ghi thu" after "ghi chi" reuses this page, so the form must start over. */}
      <Fresh>
        <TxForm
          key={type}
          action={createTransaction}
          categories={categories}
          memberFees={{ members, settings, fromMonth: thisMonth }}
          guestFees={guestDebtors(debtors)}
          submitLabel="Lưu"
          initialValues={{
            type,
            category_id: "",
            amount: "",
            occurred_on: todayInVietnam(),
            description: "",
          }}
        />
      </Fresh>
    </div>
  );
}

export default function NewTxPage({ searchParams }: PageProps<"/fund/new">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Ghi thu chi" backHref="/fund" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <NewTx searchParams={searchParams} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
