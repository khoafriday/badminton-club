import Link from "next/link";
import { logout } from "@/app/actions/auth";

// Placeholder home until the Dashboard screen is built.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Badminton Club</h1>
        <form action={logout}>
          <button className="text-sm text-zinc-500">Đăng xuất</button>
        </form>
      </header>
      <p className="text-zinc-600">Bản mẫu Bước 4. Các màn còn lại sẽ làm ở bước sau.</p>
      <Link
        href="/sessions/demo"
        className="flex h-12 items-center justify-center rounded-lg bg-brand-600 font-semibold text-white"
      >
        Mở màn Điểm danh buổi (dữ liệu mẫu)
      </Link>
    </main>
  );
}
