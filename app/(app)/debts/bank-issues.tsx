import { resolveBankIssue } from "@/app/actions/payments";
import { formatVnd } from "@/lib/billing";
import type { BankIssue } from "@/lib/payments";

const when = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function problem(issue: BankIssue): string {
  if (issue.status === "unmatched") return "Không tìm thấy mã QR. Chưa đánh Đã nộp.";
  if (issue.status === "overpaid") {
    return `Đã đánh Đã nộp. Chuyển thừa ${formatVnd(issue.amount - (issue.requestAmount ?? issue.amount))}.`;
  }
  return `Không khớp số nợ${issue.requestAmount ? ` ${formatVnd(issue.requestAmount)}` : ""} hoặc nợ đã đổi. Chưa đánh Đã nộp.`;
}

/** Transfers with one of our codes that the app could not settle cleanly. The admin settles them by hand. */
export function BankIssues({ issues }: { issues: BankIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <>
      <div className="mx-5 mt-3">
        <h2 className="section-title">Chuyển khoản cần xem</h2>
      </div>
      <ul className="mx-5 flex flex-col gap-2">
        {issues.map((i) => (
          <li key={i.id} className="card flex flex-col gap-1 border-amber-200 bg-amber-50 p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="font-bold">{i.memberName ?? "Không rõ người gửi"}</span>
              <span className="font-bold">{formatVnd(i.amount)}</span>
            </div>
            <p className="text-xs text-muted">
              {when.format(new Date(i.occurredAt))} · {i.content}
            </p>
            <p>{problem(i)}</p>
            <form action={resolveBankIssue.bind(null, i.id)}>
              <button className="mt-1 h-10 rounded-full border border-line-strong px-4 text-xs font-bold">
                Đã xử lý xong
              </button>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
