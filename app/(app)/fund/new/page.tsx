import { Suspense } from "react";
import { createTransaction } from "@/app/actions/fund";
import { NoClub } from "@/app/clubs/no-club";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { loadClub, todayInVietnam } from "@/lib/club";
import { listCategories } from "@/lib/fund";
import { TxForm } from "../tx-form";

async function NewTx({ searchParams }: { searchParams: PageProps<"/fund/new">["searchParams"] }) {
  const sp = await searchParams;
  const { club } = await loadClub();
  if (!club) return <NoClub />;
  const categories = await listCategories(club.id);
  const type = sp.type === "income" ? "income" : "expense";
  return (
    <div className="px-5 py-6">
      {/* key: opening "ghi thu" after "ghi chi" reuses this page, so the form must start over. */}
      <TxForm
        key={type}
        action={createTransaction}
        categories={categories}
        submitLabel="Lưu"
        initialValues={{
          type,
          category_id: "",
          amount: "",
          occurred_on: todayInVietnam(),
          description: "",
        }}
      />
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
