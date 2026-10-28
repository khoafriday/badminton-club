import Link from "next/link";

/** A card that opens a screen for the admin, and is plain text for a member (href null). */
export function MaybeLink({
  href,
  className,
  children,
}: {
  href: string | null;
  className: string;
  children: React.ReactNode;
}) {
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}
