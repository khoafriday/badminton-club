import { connection } from "next/server";
import { getCurrentClub, listClubs, requireUser } from "@/lib/club";
import { missingDatabaseEnv } from "@/lib/supabase";
import { ClubSelect } from "./club-select";

/**
 * Dropdown of the user's clubs at the top of a screen. Picking one makes it the current club,
 * so every screen then shows only that club's data. Nothing shows before the first club exists.
 */
export async function ClubPicker({ variant = "pill" }: { variant?: "pill" | "title" }) {
  await connection();
  if (missingDatabaseEnv().length > 0) return null;
  const userId = await requireUser();
  // getCurrentClub is cached per request and already lists the clubs, so this adds no extra query.
  const [club, clubs] = await Promise.all([getCurrentClub(userId), listClubs(userId)]);
  if (!club) return null;
  return <ClubSelect clubs={clubs.map((c) => ({ id: c.id, name: c.name }))} currentId={club.id} variant={variant} />;
}
