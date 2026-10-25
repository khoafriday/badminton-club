import { connection } from "next/server";
import { isDatabaseConfigured } from "@/lib/supabase";

/** Renders its children only once Supabase is connected. Checked per request, not at build time. */
export async function RequireDatabase({ children }: { children: React.ReactNode }) {
  await connection();
  if (isDatabaseConfigured()) return children;
  return (
    <div className="m-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Chưa nối database</p>
      <p className="mt-1">
        Thêm SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trong Environment Variables trên Vercel, rồi Redeploy.
      </p>
    </div>
  );
}
