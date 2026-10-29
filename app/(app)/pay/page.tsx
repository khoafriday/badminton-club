import QRCode from "qrcode";
import { Suspense } from "react";
import { openPaymentQr } from "@/app/actions/payments";
import { RequireDatabase } from "@/app/ui/database-missing";
import { primaryButtonClass } from "@/app/ui/form";
import { Loading } from "@/app/ui/loading";
import { PageHeader } from "@/app/ui/page-header";
import { formatVnd } from "@/lib/billing";
import { loadViewer } from "@/lib/club";
import { getT } from "@/lib/i18n/server";
import { loadMemberHistory } from "@/lib/member-history";
import { getBankAccount, isCurrent, latestPaymentRequest } from "@/lib/payments";
import { TPBANK_BIN, vietQrPayload } from "@/lib/vietqr";
import { BackHomeCountdown, CopyButton, WaitForPayment } from "./pay-parts";

const BANK_NAME: Record<string, string> = { [TPBANK_BIN]: "TPBank" };

function Note({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "ok" | "warn" }) {
  const color = { muted: "", ok: "border-brand-100 bg-brand-50", warn: "border-amber-200 bg-amber-50 text-amber-900" }[tone];
  return <section className={`card flex flex-col gap-2 p-4 text-sm ${color}`}>{children}</section>;
}

function PayAgain({ label }: { label: string }) {
  return (
    <form action={openPaymentQr}>
      <button className={`${primaryButtonClass} w-full`}>{label}</button>
    </form>
  );
}

function Row({ label, value, copy }: { label: string; value: string; copy?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-xs text-muted">{label}</span>
        <span className="block font-bold tracking-tight break-all">{value}</span>
      </span>
      {copy && <CopyButton text={copy} />}
    </div>
  );
}

/** The QR a member opens from "Đóng tiền nợ": everything they owe, paid by one transfer that the app confirms itself. */
async function PayContent() {
  const [viewer, t] = await Promise.all([loadViewer(), getT()]);
  if (viewer.kind !== "member") return <Note>{t("Màn này dành cho thành viên.")}</Note>;
  const { club, memberId } = viewer;
  const [bank, request, history] = await Promise.all([
    getBankAccount(club.id),
    latestPaymentRequest(club.id, memberId),
    loadMemberHistory(memberId),
  ]);
  if (!bank) return <Note>{t("CLB chưa cài tài khoản nhận tiền. Liên hệ admin để đóng tiền.")}</Note>;

  if (request?.status === "paid") {
    const extra = (request.receivedAmount ?? request.amount) - request.amount;
    return (
      <>
        <Note tone="ok">
          <p className="text-lg font-bold text-brand-700">
            {history.owed === 0
              ? t("Đã thanh toán hết các khoản nợ của CLB {club},", { club: club.name })
              : t("Đã thanh toán {amount} cho CLB {club},", { amount: formatVnd(request.amount), club: club.name })}
          </p>
          <p>{t("Chúc bạn tiếp tục chơi cầu vui vẻ!")}</p>
        </Note>
        {extra > 0 && (
          <Note tone="warn">
            {t("Bạn đã chuyển thừa {amount}. Liên hệ admin để được xử lý phần tiền thừa.", { amount: formatVnd(extra) })}
          </Note>
        )}
        <BackHomeCountdown />
      </>
    );
  }
  if (request?.status === "needs_review") {
    return (
      <>
        <Note tone="warn">
          <p className="font-bold">
            {t("Đã nhận {amount} cho mã {code}", { amount: formatVnd(request.receivedAmount ?? 0), code: request.code })}
          </p>
          <p>{t("Số tiền không khớp số nợ lúc chuyển, nên chưa đánh Đã nộp. Liên hệ admin để được xử lý.")}</p>
        </Note>
      </>
    );
  }
  if (!request || !(await isCurrent(request, memberId))) {
    if (history.owed === 0) return <Note tone="ok">{t("Bạn không còn khoản nợ nào.")}</Note>;
    return (
      <>
        <Note>{t("Số nợ đã thay đổi so với mã QR trước. Tạo mã mới cho {amount}.", { amount: formatVnd(history.owed) })}</Note>
        <PayAgain label={t("Tạo mã QR mới")} />
      </>
    );
  }

  const payload = vietQrPayload({ bin: bank.bin, accountNo: bank.accountNo, amount: request.amount, note: request.code });
  // Always dark on white, also in dark mode: banking apps read that best.
  const svg = await QRCode.toString(payload, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
  return (
    <>
      <section className="card flex flex-col items-center gap-3 p-4">
        <div
          className="w-full max-w-72 rounded-2xl bg-[#ffffff] p-2"
          role="img"
          aria-label={t("Mã QR chuyển {amount}", { amount: formatVnd(request.amount) })}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="text-2xl font-bold tracking-tight text-red-600">{formatVnd(request.amount)}</p>
        <p className="text-center text-xs text-muted">{t("Mở app ngân hàng, quét mã. Không sửa số tiền và nội dung.")}</p>
      </section>
      <section className="card flex flex-col gap-3 p-4">
        <Row label={t("Ngân hàng")} value={BANK_NAME[bank.bin] ?? bank.bin} />
        <Row label={t("Số tài khoản")} value={bank.accountNo} copy={bank.accountNo} />
        <Row label={t("Chủ tài khoản")} value={bank.accountName} />
        <Row label={t("Nội dung chuyển khoản")} value={request.code} copy={request.code} />
      </section>
      <WaitForPayment />
    </>
  );
}

export default function PayPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Đóng tiền nợ" backHref="/" />
      <Suspense fallback={<Loading />}>
        <RequireDatabase>
          <div className="flex flex-col gap-3 px-5 py-4">
            <PayContent />
          </div>
        </RequireDatabase>
      </Suspense>
    </main>
  );
}
