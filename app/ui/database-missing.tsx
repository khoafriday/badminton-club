import { connection } from "next/server";
import { missingDatabaseEnv } from "@/lib/supabase";

/** Renders its children only once Supabase is connected. Checked per request, not at build time. */
export async function RequireDatabase({ children }: { children: React.ReactNode }) {
  await connection();
  const missing = missingDatabaseEnv();
  if (missing.length === 0) return children;
  return (
    <div className="m-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Chưa nối database</p>
      <p className="mt-1">Bản deploy này đang thiếu: {missing.join(", ")}.</p>
      <p className="mt-1">
        Thêm đúng tên đó trong Environment Variables trên Vercel (tick cả Preview), rồi Redeploy. Biến chỉ có tác dụng
        với bản build sau khi thêm.
      </p>
    </div>
  );
}
