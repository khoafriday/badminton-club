import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { switchClub } from "@/app/actions/settings";
import { NoClub } from "@/app/clubs/no-club";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { formatVnd } from "@/lib/billing";
import { getPriceSettings, listClubs, loadClub } from "@/lib/club";
import { listCourts } from "@/lib/courts";
import { formatVndInput } from "@/lib/money";
import { ArchiveClubButton, ClubInfoForm, PricesForm } from "./settings-forms";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-zinc-100 px-5 py-5">
      <h2 className="font-bold">{title}</h2>
      {children}
    </section>
  );
}

async function SettingsContent() {
  const { userId, club } = await loadClub();
  if (!club) return <NoClub />;
  const [prices, clubs, courts] = await Promise.all([getPriceSettings(club.id), listClubs(userId), listCourts(userId)]);

  return (
    <>
      <Section title="Giá">
        {/* key: a club switch must reset the form, not keep the last club's values. */}
        <PricesForm
          key={club.id}
          initial={{
            monthly_fee_male: formatVndInput(prices.monthlyFeeMale),
            monthly_fee_female: formatVndInput(prices.monthlyFeeFemale),
            guest_price_male: formatVndInput(prices.guestPriceMale),
            guest_price_female: formatVndInput(prices.guestPriceFemale),
          }}
        />
      </Section>

      <Section title="Thông tin CLB">
        <ClubInfoForm key={club.id} courts={courts} initial={{ name: club.name, court_id: club.court_id ?? "" }} />
      </Section>

      <Section title="Sân cầu">
        <p className="-mt-2 text-xs text-zinc-500">Dùng chung cho mọi CLB của bạn.</p>
        {courts.length > 0 && (
          <ul className="flex flex-col gap-2">
            {courts.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/settings/courts/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-300 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {c.name}
                      {c.id === club.court_id && (
                        <span className="ml-2 text-xs font-semibold text-brand-700">CLB này</span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">{c.address ?? "Chưa có địa chỉ"}</span>
                  </span>
                  <span className="shrink-0 text-sm text-zinc-700">
                    {c.price > 0 ? `${formatVnd(c.price)}/giờ` : "Chưa có giá"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/settings/courts/new"
          className="flex h-11 items-center justify-center rounded-lg border-2 border-brand-600 text-sm font-semibold text-brand-700"
        >
          + Thêm sân
        </Link>
      </Section>

      <Section title="Các CLB của bạn">
        <ul className="flex flex-col gap-2">
          {clubs.map((c) => (
            <li key={c.id}>
              {c.id === club.id ? (
                <div className="flex h-12 items-center justify-between rounded-lg border-2 border-brand-600 bg-brand-50 px-3">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs font-semibold text-brand-700">Đang dùng</span>
                </div>
              ) : (
                <form action={switchClub.bind(null, c.id)}>
                  <button className="flex h-12 w-full items-center justify-between rounded-lg border border-zinc-300 px-3 text-left">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-zinc-500">Chuyển sang</span>
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <Link
          href="/settings/clubs/new"
          className="flex h-11 items-center justify-center rounded-lg border-2 border-brand-600 text-sm font-semibold text-brand-700"
        >
          + Tạo CLB mới
        </Link>
        <ArchiveClubButton clubName={club.name} />
      </Section>
    </>
  );
}

export default function SettingsPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Cài đặt" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <SettingsContent />
        </RequireDatabase>
      </Suspense>
      <div className="px-5 py-6">
        <form action={logout}>
          <button className="h-11 w-full rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-700">Đăng xuất</button>
        </form>
      </div>
    </main>
  );
}
