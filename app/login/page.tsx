import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-10 px-6 py-12">
      <div className="flex flex-col items-center gap-2">
        <div className="hero flex size-20 items-center justify-center text-4xl">🏸</div>
        <h1 className="mt-3 text-[28px] font-bold tracking-tight">Badminton Club</h1>
        <p className="text-sm text-muted">Đăng nhập bằng ID của bạn</p>
      </div>
      <LoginForm />
    </main>
  );
}
