import { Suspense } from "react";
import { createTransaction } from "@/app/actions/fund";
import { NoClub } from "@/app/clubs/no-club";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { Fresh } from "@/app/ui/fresh";
import { PageHeader } from "@/app/ui/page-header";
import { getPriceSettings, loadClub, todayInVietnam } from "@/lib/club";
import { listUnpaidFees, priceUnpricedSlips } from "@/lib/fees";
import { listCategories } from "@/lib/fund";
import { TxForm } from "../tx-form";

async function NewTx({ searchParams }: { searchParams: PageProps<"/fund/new">["searchParams"] }) {
  const sp = await searchParams;
  const { club } = await loadClub();
  if (!club) return <NoClub />;
  const [categories, unpaidFees] = await Promise.all([
    listCategories(club.id),
    getPriceSettings(club.id)
      .then((s) => priceUnpricedSlips(club.id, s))
      .then(() => listUnpaidFees(club.id)),
  ]);
  const type = sp.type === "income" ? "income" : "expense";
  return (
    <div className="px-5 py-6">
      {/* key: opening "ghi thu" after "ghi chi" reuses this page, so the form must start over. */}
      <Fresh>
        <TxForm
          key={type}
          action={createTransaction}
          categories={categories}
          unpaidFees={unpaidFees}
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
