import Link from "next/link";

/** Round + button in the bottom right, above the bottom menu. */
export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="fixed bottom-24 right-[max(1.5rem,calc(50%-14rem+1.5rem))] z-10 flex size-14 items-center justify-center rounded-full bg-brand-600 text-3xl text-white shadow-lg active:bg-brand-700"
    >
      +
    </Link>
  );
}
