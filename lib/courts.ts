import "server-only";
import { db } from "./supabase";

export type Court = { id: string; name: string; address: string | null; price: number };

type CourtRow = { id: string; name: string; address: string | null; price: number | string };

// bigint columns can arrive as strings; prices are whole VND well inside Number range.
const toCourt = (row: CourtRow): Court => ({ ...row, price: Number(row.price) });

/** SAN-1: the user's courts, shared by all their clubs, oldest first. */
export async function listCourts(userId: string): Promise<Court[]> {
  const { data, error } = await db()
    .from("courts")
    .select("id, name, address, price")
    .eq("owner_id", userId)
    .order("created_at");
  if (error) throw error;
  return data.map(toCourt);
}

/** The courts a club has registered (club_courts), oldest link first. The MVP gives a club at most one. */
export async function listClubCourts(clubId: string): Promise<Court[]> {
  const { data, error } = await db()
    .from("club_courts")
    .select("courts(id, name, address, price)")
    .eq("club_id", clubId)
    .order("created_at")
    .overrideTypes<{ courts: CourtRow | null }[], { merge: false }>();
  if (error) throw error;
  return data.flatMap((r) => (r.courts ? [toCourt(r.courts)] : []));
}

export async function getCourt(userId: string, courtId: string): Promise<Court | null> {
  const { data, error } = await db()
    .from("courts")
    .select("id, name, address, price")
    .eq("id", courtId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data && toCourt(data);
}

/**
 * Makes `courtId` the club's court, or leaves the club without one when null.
 * The table allows several courts per club; the MVP keeps exactly one.
 */
export async function setClubCourt(clubId: string, courtId: string | null) {
  if (courtId) {
    const { error } = await db()
      .from("club_courts")
      .upsert({ club_id: clubId, court_id: courtId }, { onConflict: "club_id,court_id", ignoreDuplicates: true });
    if (error) throw error;
  }
  let others = db().from("club_courts").delete().eq("club_id", clubId);
  if (courtId) others = others.neq("court_id", courtId);
  const { error } = await others;
  if (error) throw error;
}
