import "server-only";
import { redirect } from "next/navigation";
import { currentUser } from "./session";
import { db } from "./supabase";

export type Club = { id: string; name: string; venue_name: string | null };

export async function requireUser(): Promise<string> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

// The login ID doubles as the profile id. Creates the row on first use.
async function ensureProfile(userId: string) {
  const { error } = await db().from("profiles").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
}

/** The club the user last worked on, else their first club. Null when they have none yet. */
export async function getCurrentClub(userId: string): Promise<Club | null> {
  await ensureProfile(userId);
  const { data: profile, error: profileError } = await db()
    .from("profiles")
    .select("last_club_id")
    .eq("id", userId)
    .single();
  if (profileError) throw profileError;

  const { data: clubs, error } = await db()
    .from("clubs")
    .select("id, name, venue_name")
    .eq("owner_id", userId)
    .is("archived_at", null)
    .order("created_at");
  if (error) throw error;

  return clubs.find((c) => c.id === profile.last_club_id) ?? clubs[0] ?? null;
}

/** Signed-in user and their current club, or null club when they have not created one yet. */
export async function loadClub(): Promise<{ userId: string; club: Club | null }> {
  const userId = await requireUser();
  return { userId, club: await getCurrentClub(userId) };
}

/** For server actions: the club the change belongs to. */
export async function requireClub(): Promise<{ userId: string; club: Club }> {
  const { userId, club } = await loadClub();
  if (!club) throw new Error("No club yet");
  return { userId, club };
}

/** Today's date (YYYY-MM-DD) in Vietnam, whatever timezone the server runs in. */
export function todayInVietnam(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}
