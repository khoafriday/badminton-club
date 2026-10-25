import Link from "next/link";

/** Round + button in the bottom right, above the bottom menu. */
export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="fixed right-[max(1.5rem,calc(50%-14rem+1.5rem))] bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-10 flex size-14 items-center justify-center rounded-full bg-brand-600 text-3xl text-white shadow-hero active:opacity-80"
    >
      +
    </Link>
  );
}
