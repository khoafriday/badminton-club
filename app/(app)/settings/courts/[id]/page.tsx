import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateCourt } from "@/app/actions/courts";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { Fresh } from "@/app/ui/fresh";
import { PageHeader } from "@/app/ui/page-header";
import { requireUser } from "@/lib/club";
import { getCourt } from "@/lib/courts";
import { formatVndInput } from "@/lib/money";
import { CourtForm, DeleteCourtButton } from "../court-form";

async function EditCourt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const court = await getCourt(await requireUser(), id);
  if (!court) notFound();

  return (
    <div className="flex flex-col gap-6 px-5 py-6">
      <Fresh>
        <CourtForm
          action={updateCourt.bind(null, court.id)}
          submitLabel="Lưu"
          initialValues={{
            name: court.name,
            address: court.address ?? "",
            price: formatVndInput(court.price),
            max_players: court.max_players?.toString() ?? "",
          }}
        />
      </Fresh>
      <DeleteCourtButton courtId={court.id} courtName={court.name} />
    </div>
  );
}

export default function EditCourtPage({ params }: PageProps<"/settings/courts/[id]">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Sửa sân" backHref="/settings" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <EditCourt params={params} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
