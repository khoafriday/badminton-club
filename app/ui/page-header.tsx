import Link from "next/link";

export function PageHeader({ title, backHref }: { title: string; backHref?: string }) {
  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center gap-2 bg-page/90 px-3 py-2 backdrop-blur">
      {backHref && (
        <Link href={backHref} aria-label="Quay lại" className="flex size-10 items-center justify-center text-3xl">
          ‹
        </Link>
      )}
      <h1 className={`text-[22px] leading-tight font-bold tracking-tight ${backHref ? "" : "px-2"}`}>{title}</h1>
    </header>
  );
}
