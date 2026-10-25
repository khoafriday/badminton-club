import { createCourt } from "@/app/actions/courts";
import { PageHeader } from "@/app/ui/page-header";
import { CourtForm } from "../court-form";

export default function NewCourtPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Thêm sân" backHref="/settings" />
      <div className="px-5 py-6">
        <CourtForm action={createCourt} submitLabel="Thêm sân" initialValues={{ name: "", address: "", price: "" }} />
      </div>
    </main>
  );
}
