import Link from "next/link";

export function PageHeader({ title, backHref }: { title: string; backHref?: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-zinc-100 bg-white px-3">
      {backHref && (
        <Link href={backHref} aria-label="Quay lại" className="flex size-10 items-center justify-center text-2xl">
          ‹
        </Link>
      )}
      <h1 className={`text-lg font-bold ${backHref ? "" : "px-2"}`}>{title}</h1>
    </header>
  );
}
