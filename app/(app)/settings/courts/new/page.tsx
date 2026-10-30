import { Suspense } from "react";
import { createCourt } from "@/app/actions/courts";
import { Fresh } from "@/app/ui/fresh";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { CourtForm } from "../court-form";

export default function NewCourtPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Thêm sân" backHref="/settings" />
      <div className="px-5 py-6">
        {/* The form's text waits for the language cookie. */}
        <Suspense fallback={<Loading />}>
          <Fresh>
            <CourtForm
              action={createCourt}
              submitLabel="Thêm sân"
              initialValues={{ name: "", address: "", price: "", max_players: "" }}
            />
          </Fresh>
        </Suspense>
      </div>
    </main>
  );
}
