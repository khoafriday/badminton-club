"use client";

import { useActionState, useState } from "react";
import { deleteSession, setSessionCancelled } from "@/app/actions/schedule";
import { inputClass } from "@/app/ui/form";
import { useT } from "@/app/ui/locale";

export function CancelSessionForm({ sessionId }: { sessionId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="h-11 w-full rounded-full border border-amber-300 text-sm font-semibold text-amber-700">
        {t("Hủy buổi")}
      </button>
    );
  }
  return (
    <form action={setSessionCancelled.bind(null, sessionId, true)} className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
      <input name="cancel_reason" placeholder={t("Lý do (không bắt buộc), ví dụ: mưa, sân bận")} className={inputClass} />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="h-11 flex-1 rounded-full bg-surface text-sm">
          {t("Thôi")}
        </button>
        <button className="h-11 flex-1 rounded-full bg-amber-600 text-sm font-semibold text-white">{t("Xác nhận hủy")}</button>
      </div>
    </form>
  );
}

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(deleteSession.bind(null, sessionId), { error: null });
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(t("Xóa buổi này? Không khôi phục được."))) e.preventDefault();
      }}
      className="flex flex-col gap-1"
    >
      <button disabled={pending} className="h-11 w-full rounded-full border border-red-200 text-sm font-semibold text-red-600">
        {t(pending ? "Đang xóa..." : "Xóa buổi")}
      </button>
      {state.error && <p className="text-sm text-red-600">{t(state.error)}</p>}
    </form>
  );
}
