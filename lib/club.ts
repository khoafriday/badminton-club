import "server-only";
import { redirect } from "next/navigation";
import type { PriceSettings } from "./billing";
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

  const clubs = await listClubs(userId);
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

export type ClubDetails = Club & { venue_address: string | null };

export async function getClubDetails(clubId: string): Promise<ClubDetails> {
  const { data, error } = await db().from("clubs").select("id, name, venue_name, venue_address").eq("id", clubId).single();
  if (error) throw error;
  return data;
}

/** All clubs the user owns that are not archived, oldest first. */
export async function listClubs(userId: string): Promise<Club[]> {
  const { data, error } = await db()
    .from("clubs")
    .select("id, name, venue_name")
    .eq("owner_id", userId)
    .is("archived_at", null)
    .order("created_at");
  if (error) throw error;
  return data;
}

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
