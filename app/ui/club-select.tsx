"use client";

import { useOptimistic, useTransition } from "react";
import { switchClub } from "@/app/actions/settings";
import { Spinner } from "./loading";

type Props = {
  clubs: { id: string; name: string }[];
  currentId: string;
  variant: "pill" | "title";
};

const VARIANT_CLASS = {
  pill: "h-10 max-w-44 truncate rounded-full border border-line-strong bg-surface pr-9 pl-3.5 text-sm font-semibold text-ink",
  title: "h-9 max-w-full truncate bg-transparent pr-8 text-xl font-bold tracking-tight text-ink",
};

export function ClubSelect({ clubs, currentId, variant }: Props) {
  const [pending, startTransition] = useTransition();
  // Shows the picked club straight away while the screens reload with its data.
  const [selected, setSelected] = useOptimistic(currentId);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <select
        aria-label="Chọn CLB"
        value={selected}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          startTransition(async () => {
            setSelected(id);
            await switchClub(id);
          });
        }}
        className={`select outline-none disabled:opacity-60 ${VARIANT_CLASS[variant]}`}
        style={{ backgroundPosition: variant === "pill" ? "right 0.75rem center" : "right 0.25rem center" }}
      >
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {pending && <Spinner className="size-4 shrink-0 text-brand-600" />}
    </span>
  );
}
