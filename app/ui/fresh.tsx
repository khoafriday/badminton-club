"use client";

import { useRouter } from "next/navigation";
import { Fragment } from "react";

/**
 * Next keeps a screen's form state when you leave and come back (React Activity). For forms that is wrong:
 * after saving, reopening a member showed the old Trạng thái. This starts the form over on every visit
 * from a link or ‹, and still keeps a half-typed form on the phone's own back/forward.
 */
export function Fresh({ children }: { children: React.ReactNode }) {
  const { bfcacheId } = useRouter();
  return <Fragment key={bfcacheId}>{children}</Fragment>;
}
