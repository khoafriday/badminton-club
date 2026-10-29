import { Bi } from "./bi";

/** A spinning ring; `currentColor` lets it take the colour of the text around it. */
export function Spinner({ className = "size-6" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-[3px] border-current border-t-transparent ${className}`}
    />
  );
}

export function Loading() {
  return (
    <div role="status" className="flex flex-col items-center gap-3 px-5 py-12 text-sm text-faint">
      <Spinner className="size-8 text-brand-600" />
      <Bi text="Đang tải..." />
    </div>
  );
}
