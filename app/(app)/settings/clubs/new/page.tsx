import { ClubForm } from "@/app/clubs/club-form";
import { PageHeader } from "@/app/ui/page-header";

export default function NewClubPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Tạo CLB mới" backHref="/settings" />
      <div className="px-5 py-6">
        <ClubForm redirectTo="/settings" />
      </div>
    </main>
  );
}
