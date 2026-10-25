import { notFound } from "next/navigation";
import { Suspense } from "react";
import { deleteTransaction, updateTransaction } from "@/app/actions/fund";
import { ConfirmButton } from "@/app/ui/confirm-button";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { formatVnd } from "@/lib/billing";
import { loadClub } from "@/lib/club";
import { listCategories } from "@/lib/fund";
import { db } from "@/lib/supabase";
import { TxForm } from "../tx-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function EditTx({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { club } = await loadClub();
  if (!club) notFound();
  const { data: tx } = await db()
    .from("transactions")
    .select("id, type, category_id, amount, occurred_on, description")
    .eq("id", id)
    .eq("club_id", club.id)
    .eq("source_type", "manual")
    .maybeSingle();
  if (!tx) notFound();
  const categories = await listCategories(club.id);

  return (
    <div className="flex flex-col gap-4 px-5 py-6">
      <TxForm
        action={updateTransaction.bind(null, tx.id)}
        categories={categories}
        submitLabel="Lưu"
        initialValues={{
          type: tx.type,
          category_id: tx.category_id,
          amount: formatVnd(Number(tx.amount)).replace("đ", ""),
          occurred_on: tx.occurred_on,
          description: tx.description ?? "",
        }}
      />
      <form action={deleteTransaction.bind(null, tx.id)}>
        <ConfirmButton
          message="Xóa khoản này khỏi sổ thu chi?"
          className="h-11 w-full rounded-lg border border-red-200 text-sm font-semibold text-red-600"
        >
          Xóa khoản này
        </ConfirmButton>
      </form>
    </div>
  );
}

export default function EditTxPage({ params }: PageProps<"/fund/[id]">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Sửa thu chi" backHref="/fund" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <EditTx params={params} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
