import Link from "next/link";
import { PageHeader } from "@/app/ui/page-header";

// Placeholder home until the Dashboard screen (DB-1, DB-2) is built.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Badminton Club" />
      <div className="flex flex-col gap-4 px-5 py-6">
        <p className="text-zinc-600">Màn Tổng quan sẽ có ở bản tới. Bắt đầu từ Cài đặt giá, rồi tạo Lịch tuần.</p>
        <Link
          href="/schedule"
          className="flex h-12 items-center justify-center rounded-lg bg-brand-600 font-semibold text-white"
        >
          Xem lịch
        </Link>
      </div>
    </main>
  );
}
