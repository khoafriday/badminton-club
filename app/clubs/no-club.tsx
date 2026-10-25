import { ClubForm } from "./club-form";

// Shown in place of a screen until the first club exists.
export function NoClub() {
  return (
    <div className="flex flex-col gap-4 px-5 py-6">
      <div>
        <h2 className="text-lg font-bold">Tạo CLB</h2>
        <p className="text-sm text-zinc-600">Bạn chưa có CLB nào. Tạo CLB đầu tiên để thêm thành viên.</p>
      </div>
      <ClubForm />
    </div>
  );
}
