import { BackButton } from "./back-button";
import { Bi } from "./bi";

/** ‹ goes to the screen opened before; `backHref` is only used when there is none. `right` sits at the right end of the bar, such as the club dropdown. */
export function PageHeader({ title, backHref, right }: { title: string; backHref?: string; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center gap-2 bg-page/90 px-3 py-2 backdrop-blur">
      {backHref && <BackButton fallback={backHref} />}
      <h1 className={`text-[22px] leading-tight font-bold tracking-tight ${backHref ? "" : "px-2"}`}>
        <Bi text={title} />
      </h1>
      {right && <div className="ml-auto flex min-w-0 justify-end pr-2">{right}</div>}
    </header>
  );
}
