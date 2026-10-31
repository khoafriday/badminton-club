import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Fresh } from "@/app/ui/fresh";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { formatLoginTime, getOwnerAccount, listLinkCandidates } from "@/lib/account-links";
import { listClubs, requireUser } from "@/lib/club";
import { getT } from "@/lib/i18n/server";
import { DeleteAccountButton, LinkMembersForm, ResetPasswordForm, UnlinkMemberButton } from "../account-forms";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function AccountDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const clubs = await listClubs(await requireUser());
  const [account, t] = await Promise.all([getOwnerAccount(clubs, id), getT()]);
  if (!account) notFound();
  const candidates = (await listLinkCandidates(clubs, account.members[0]?.name)).filter((c) => c.accountId !== id);
  const takenClubIds = account.members.map((m) => m.clubId);

  return (
    <div className="flex flex-col gap-6 px-5 pt-1 pb-6">
      <div className="card flex flex-col gap-1 p-4">
        <span className="text-[22px] font-bold">{account.loginId}</span>
        <span className="text-sm text-muted">
          {t(account.passwordChanged ? "Thành viên đã đổi mật khẩu." : "Chưa đổi mật khẩu lần đầu.")}
        </span>
        <span className="text-sm text-muted">
          {account.lastLoginAt
            ? t("Đăng nhập gần nhất: {time}", { time: formatLoginTime(account.lastLoginAt) })
            : t("Chưa đăng nhập")}
        </span>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="section-title">{t("Thành viên đang gắn")}</h2>
        <ul className="card divide-y divide-line px-4">
          {account.members.map((m) => (
            <li key={m.memberId} className="flex items-center justify-between gap-3 py-3">
              <Link href={`/members/${m.memberId}`} className="min-w-0">
                <span className="block font-semibold">{m.name}</span>
                <span className="block text-xs text-muted">
                  {m.clubName}
                  {m.status !== "active" && ` · ${t("Nghỉ")}`}
                </span>
              </Link>
              <UnlinkMemberButton
                accountId={account.id}
                memberId={m.memberId}
                name={m.name}
                last={account.members.length === 1}
              />
            </li>
          ))}
        </ul>
      </section>

      {candidates.some((c) => !takenClubIds.includes(c.clubId)) && (
        <section className="flex flex-col gap-2">
          <h2 className="section-title">{t("Gắn thêm thành viên")}</h2>
          <div className="card p-4">
            <Fresh>
              <LinkMembersForm accountId={account.id} candidates={candidates} takenClubIds={takenClubIds} />
            </Fresh>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="section-title">{t("Mật khẩu")}</h2>
        <div className="card p-4">
          <Fresh>
            <ResetPasswordForm accountId={account.id} />
          </Fresh>
        </div>
      </section>

      <DeleteAccountButton accountId={account.id} loginId={account.loginId} />
    </div>
  );
}

export default function AccountPage({ params }: PageProps<"/settings/accounts/[id]">) {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Chi tiết tài khoản" backHref="/settings/accounts" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <AccountDetail params={params} />
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
