import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { loadViewer } from "@/lib/club";
import { getAccount } from "@/lib/member-accounts";
import { ChangePasswordForm } from "./change-password-form";

/** A member's own screen: their login and clubs, password change, sign out. The admin has Cài đặt instead. */
async function Account({ searchParams }: { searchParams: PageProps<"/account">["searchParams"] }) {
  const [sp, viewer] = await Promise.all([searchParams, loadViewer()]);
  if (viewer.kind !== "member") redirect("/settings");
  const account = await getAccount(viewer.accountId);
  // Offered after each login until the member has changed the first password once.
  const welcome = sp.welcome === "1" && account && !account.password_changed;

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      {welcome && (
        <section className="card flex flex-col gap-2 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Bạn có muốn đổi mật khẩu mới không?</p>
          <p>Mật khẩu hiện tại do chủ CLB đặt. Đổi xong, app sẽ không hỏi lại.</p>
          <Link href="/" className="self-start font-semibold underline">
            Để sau
          </Link>
        </section>
      )}
      {sp.changed === "1" && <p className="rounded-2xl bg-brand-50 p-3 text-sm text-brand-700">Đã đổi mật khẩu.</p>}
      <section className="card flex flex-col gap-1 p-4">
        <p className="text-lg font-bold">{viewer.name}</p>
        <p className="text-sm text-muted">ID {account?.login_id}</p>
        <p className="text-sm text-muted">{viewer.clubs.map((c) => c.name).join(", ")}</p>
      </section>
      <section className="card p-4">
        <h2 className="section-title mb-3">Đổi mật khẩu</h2>
        <ChangePasswordForm />
      </section>
      <a
        href="/logout"
        className="flex h-11 items-center justify-center rounded-full border border-line-strong text-sm font-semibold text-muted"
      >
        Đăng xuất
      </a>
    </div>
  );
}

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Tài khoản" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <Account searchParams={searchParams} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
