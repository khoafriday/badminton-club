import Link from "next/link";

/** `right` sits at the right end of the bar, such as the club dropdown. */
export function PageHeader({ title, backHref, right }: { title: string; backHref?: string; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center gap-2 bg-page/90 px-3 py-2 backdrop-blur">
      {backHref && (
        <Link href={backHref} aria-label="Quay lại" className="flex size-10 items-center justify-center text-3xl">
          ‹
        </Link>
      )}
      <h1 className={`text-[22px] leading-tight font-bold tracking-tight ${backHref ? "" : "px-2"}`}>{title}</h1>
      {right && <div className="ml-auto flex min-w-0 justify-end pr-2">{right}</div>}
    </header>
  );
}
