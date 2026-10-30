"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/app/ui/locale";

/** Asks the server again every few seconds while the QR waits for money, so the screen turns to Đã nhận by itself. */
export function WaitForPayment() {
  const t = useT();
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      // Stop after 20 minutes; reopening the screen starts again.
      if (Date.now() - started > 20 * 60 * 1000) clearInterval(timer);
      else if (document.visibilityState === "visible") router.refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [router]);
  return <p className="text-center text-sm text-muted">{t("Đang chờ tiền về. Màn này tự cập nhật.")}</p>;
}

export function CopyButton({ text }: { text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
      className="h-9 shrink-0 rounded-full border border-line-strong px-3 text-xs font-bold"
    >
      {t(copied ? "Đã chép" : "Chép")}
    </button>
  );
}

/** The money came: counts down, then goes back to Tổng quan unless the member already left with ‹. */
export function BackHomeCountdown({ seconds = 5 }: { seconds?: number }) {
  const t = useT();
  const router = useRouter();
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) {
      router.replace("/");
      return;
    }
    const timer = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(timer);
  }, [left, router]);
  return <p className="text-center text-sm text-muted">{t("Tự quay về Tổng quan sau {count} giây...", { count: Math.max(left, 0) })}</p>;
}
