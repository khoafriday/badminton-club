import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-2">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl text-white">🏸</div>
        <h1 className="text-2xl font-bold">Badminton Club</h1>
        <p className="text-sm text-zinc-500">Đăng nhập để quản lý CLB</p>
      </div>
      <LoginForm />
    </main>
  );
}
