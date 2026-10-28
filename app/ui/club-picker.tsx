import { connection } from "next/server";
import { getCurrentClub, listClubs, loadViewer } from "@/lib/club";
import { missingDatabaseEnv } from "@/lib/supabase";
import { ClubSelect } from "./club-select";

/**
 * Dropdown of the user's clubs at the top of a screen. Picking one makes it the current club,
 * so every screen then shows only that club's data. Nothing shows before the first club exists.
 */
export async function ClubPicker({
  variant = "pill",
  adminOnly = false,
}: {
  variant?: "pill" | "title";
  /** Lịch shows a member every club at once, so it has no picker for them. */
  adminOnly?: boolean;
}) {
  await connection();
  if (missingDatabaseEnv().length > 0) return null;
  // A member picks among the clubs they play in; with one club there is nothing to pick.
  const viewer = await loadViewer();
  if (viewer.kind === "member") {
    if (adminOnly || viewer.clubs.length < 2) return null;
    return (
      <ClubSelect
        clubs={viewer.clubs.map((c) => ({ id: c.id, name: c.name }))}
        currentId={viewer.club.id}
        variant={variant}
      />
    );
  }
  const userId = viewer.userId;
  // getCurrentClub is cached per request and already lists the clubs, so this adds no extra query.
  const [club, clubs] = await Promise.all([getCurrentClub(userId), listClubs(userId)]);
  if (!club) return null;
  return <ClubSelect clubs={clubs.map((c) => ({ id: c.id, name: c.name }))} currentId={club.id} variant={variant} />;
}
