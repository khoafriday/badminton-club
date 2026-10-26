import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { PriceSettings } from "./billing";
import { currentUser } from "./session";
import { db } from "./supabase";

/** The club's court from Settings (SAN-1), null until one is picked. */
export type Club = { id: string; name: string; court_id: string | null; court_name: string | null };

// PostgREST returns the court as one object (club_courts.court_id points at one row).
type ClubRow = { id: string; name: string; club_courts: { court_id: string; courts: { name: string } | null }[] };

// The MVP gives a club one court; when several are allowed, the first one is the default.
const CLUB_COLUMNS = "id, name, club_courts(court_id, courts(name))";
const toClub = (row: ClubRow): Club => ({
  id: row.id,
  name: row.name,
  court_id: row.club_courts[0]?.court_id ?? null,
  court_name: row.club_courts[0]?.courts?.name ?? null,
});

export async function requireUser(): Promise<string> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

// The login ID doubles as the profile id. The row is created on first use.
async function ensureProfile(userId: string) {
  const { error } = await db().from("profiles").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
}

/**
 * The club the user last worked on, else their first club. Null when they have none yet.
 * Cached per request: a page and its parts call this many times but the database is asked once.
 */
export const getCurrentClub = cache(async (userId: string): Promise<Club | null> => {
  // Profile and clubs are read together; the profile row is only written the first time.
  const [{ data: profile, error: profileError }, clubs] = await Promise.all([
    db().from("profiles").select("last_club_id").eq("id", userId).maybeSingle(),
    listClubs(userId),
  ]);
  if (profileError) throw profileError;
  if (!profile) await ensureProfile(userId);

  return clubs.find((c) => c.id === profile?.last_club_id) ?? clubs[0] ?? null;
});

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

/** All clubs the user owns that are not archived, oldest first. Cached per request like getCurrentClub. */
export const listClubs = cache(async (userId: string): Promise<Club[]> => {
  const { data, error } = await db()
    .from("clubs")
    .select(CLUB_COLUMNS)
    .eq("owner_id", userId)
    .is("archived_at", null)
    .order("created_at")
    .overrideTypes<ClubRow[], { merge: false }>();
  if (error) throw error;
  return data.map(toClub);
});

/** Club prices (GIA-1, GIA-2, PHI-3). A club created without a settings row gets one with zero prices. */
export async function getPriceSettings(clubId: string): Promise<PriceSettings> {
  const { data, error } = await db()
    .from("club_settings")
    .select("monthly_fee_male, monthly_fee_female, guest_price_male, guest_price_female")
    .eq("club_id", clubId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    await db().from("club_settings").upsert({ club_id: clubId }, { onConflict: "club_id", ignoreDuplicates: true });
    return { monthlyFeeMale: 0, monthlyFeeFemale: 0, guestPriceMale: 0, guestPriceFemale: 0 };
  }
  // bigint columns can arrive as strings; prices are whole VND well inside Number range.
  return {
    monthlyFeeMale: Number(data.monthly_fee_male),
    monthlyFeeFemale: Number(data.monthly_fee_female),
    guestPriceMale: Number(data.guest_price_male),
    guestPriceFemale: Number(data.guest_price_female),
  };
}
