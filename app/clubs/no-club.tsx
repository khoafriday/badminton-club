import { requireUser } from "@/lib/club";
import { listCourts } from "@/lib/courts";
import { getT } from "@/lib/i18n/server";
import { ClubForm } from "./club-form";

// Shown in place of a screen until the first club exists.
export async function NoClub() {
  const [courts, t] = await Promise.all([requireUser().then(listCourts), getT()]);
  return (
    <div className="flex flex-col gap-4 px-5 py-6">
      <div>
        <h2 className="text-lg font-bold">{t("Tạo CLB")}</h2>
        <p className="text-sm text-muted">{t("Bạn chưa có CLB nào. Tạo CLB đầu tiên để thêm thành viên.")}</p>
      </div>
      <ClubForm courts={courts} />
    </div>
  );
}
