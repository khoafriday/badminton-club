import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { switchClub } from "@/app/actions/settings";
import { NoClub } from "@/app/clubs/no-club";
import { RequireDatabase } from "@/app/ui/database-missing";
import { Bi } from "@/app/ui/bi";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { formatVnd } from "@/lib/billing";
import { getPriceSettings, listClubs, loadClub } from "@/lib/club";
import { listCourts } from "@/lib/courts";
import { getT } from "@/lib/i18n/server";
import { formatVndInput } from "@/lib/money";
import { getBankAccount } from "@/lib/payments";
import { ArchiveClubButton, BankAccountForm, ClubInfoForm, PricesForm } from "./settings-forms";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 px-5 pt-2 pb-4">
      <h2 className="section-title">{title}</h2>
      <div className="card flex flex-col gap-3 p-4">{children}</div>
    </section>
  );
}

/** Separates the current club's settings (above) from the ones shared by every club (below). */
function SettingsDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-4 pb-2">
      <hr className="flex-1 border-line-strong" />
      <span className="text-[11px] font-bold tracking-wider text-faint uppercase">{label}</span>
      <hr className="flex-1 border-line-strong" />
    </div>
  );
}

async function SettingsContent() {
  const { userId, club } = await loadClub();
  if (!club) return <NoClub />;
  const [prices, clubs, courts, bank, t] = await Promise.all([
    getPriceSettings(club.id),
    listClubs(userId),
    listCourts(userId),
    getBankAccount(club.id),
    getT(),
  ]);

  return (
    <>
      <Section title={t("Chọn CLB")}>
        <ul className="flex flex-col gap-2">
          {clubs.map((c) => (
            <li key={c.id}>
              {c.id === club.id ? (
                <div className="flex h-12 items-center justify-between rounded-2xl border-2 border-brand-600 px-4">
                  <span className="font-semibold">{c.name}</span>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">{t("Đang dùng")}</span>
                </div>
              ) : (
                <form action={switchClub.bind(null, c.id)}>
                  <button className="flex h-12 w-full items-center justify-between rounded-2xl bg-surface-2 px-4 text-left">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-xs text-muted">{t("Chuyển sang")} ›</span>
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <Link
          href="/settings/clubs/new"
          className="flex h-11 items-center justify-center rounded-full border border-line-strong bg-surface text-sm font-bold text-ink"
        >
          + {t("Tạo CLB mới")}
        </Link>
      </Section>

      <Section title={t("Thông tin CLB")}>
        <ClubInfoForm key={club.id} courts={courts} initial={{ name: club.name, court_id: club.court_id ?? "" }} />
        <ArchiveClubButton clubName={club.name} />
      </Section>

      <Section title={t("Giá tham gia")}>
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

      <Section title={t("Tài khoản nhận tiền")}>
        <BankAccountForm
          key={club.id}
          initial={{ bank_account_no: bank?.accountNo ?? "", bank_account_name: bank?.accountName ?? "" }}
        />
      </Section>

      <SettingsDivider label={t("Cấu hình chung")} />
      <Section title={t("Tài khoản thành viên")}>
        <Link
          href="/settings/accounts"
          className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3"
        >
          <span className="min-w-0">
            <span className="block font-semibold">{t("Quản lý tài khoản")}</span>
            <span className="block text-xs text-muted">{t("ID đăng nhập của thành viên ở mọi CLB")}</span>
          </span>
          <span className="shrink-0 text-muted">›</span>
        </Link>
      </Section>
      <Section title={t("Sân cầu")}>
        {courts.length > 0 && (
          <ul className="flex flex-col gap-2">
            {courts.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/settings/courts/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {c.name}
                      {c.id === club.court_id && (
                        <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                          {t("CLB này")}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {c.address ?? t("Chưa có địa chỉ")}
                      {c.max_players && ` · ${t("Tối đa {count} người", { count: c.max_players })}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold">
                    {c.price > 0 ? t("{price}/giờ", { price: formatVnd(c.price) }) : t("Chưa có giá")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/settings/courts/new"
          className="flex h-11 items-center justify-center rounded-full border border-line-strong bg-surface text-sm font-bold text-ink"
        >
          + {t("Thêm sân")}
        </Link>
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
      <div className="px-5 pt-2 pb-6">
        <form action={logout}>
          <button className="card h-12 w-full text-sm font-bold text-red-600">
            <Bi text="Đăng xuất" />
          </button>
        </form>
      </div>
    </main>
  );
}
