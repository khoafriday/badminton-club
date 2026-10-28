"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Asks the server again every few seconds while the QR waits for money, so the screen turns to Đã nhận by itself. */
export function WaitForPayment() {
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
  return <p className="text-center text-sm text-muted">Đang chờ tiền về. Màn này tự cập nhật.</p>;
}

export function CopyButton({ text }: { text: string }) {
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
      {copied ? "Đã chép" : "Chép"}
    </button>
  );
}

/** The money came: back to Tổng quan, which thanks the member for this code. */
export function BackHomePaid({ code }: { code: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/?paid=${encodeURIComponent(code)}`);
  }, [router, code]);
  return <p className="text-center text-sm text-muted">Đang quay về Tổng quan...</p>;
}
