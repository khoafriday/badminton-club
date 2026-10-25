"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentClub, requireUser } from "@/lib/club";
import { parseCourt, readCourtForm, type CourtFormValues } from "@/lib/court-form";
import { setClubCourt } from "@/lib/courts";
import { db } from "@/lib/supabase";

export type CourtFormState = { error: string | null; values: CourtFormValues };

export async function createCourt(_prev: CourtFormState, formData: FormData): Promise<CourtFormState> {
  const userId = await requireUser();
  const values = readCourtForm(formData);
  const parsed = parseCourt(values);
  if ("error" in parsed) return { error: parsed.error, values };

  const { data: court, error } = await db()
    .from("courts")
    .insert({ ...parsed.data, owner_id: userId })
    .select("id")
    .single();
  if (error) return { error: "Không lưu được. Thử lại sau.", values };

  // A club with no court yet gets the first one added, so it does not need a second step.
  const club = await getCurrentClub(userId);
  if (club && !club.court_name) await setClubCourt(club.id, court.id);
  revalidatePath("/", "layout");
  redirect("/settings");
}

export async function updateCourt(courtId: string, _prev: CourtFormState, formData: FormData): Promise<CourtFormState> {
  const userId = await requireUser();
  const values = readCourtForm(formData);
  const parsed = parseCourt(values);
  if ("error" in parsed) return { error: parsed.error, values };

  // owner_id in the filter stops an edit from reaching another login's court.
  const { error } = await db()
    .from("courts")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", courtId)
    .eq("owner_id", userId);
  if (error) return { error: "Không lưu được. Thử lại sau.", values };
  revalidatePath("/", "layout");
  redirect("/settings");
}

export type DeleteCourtState = { error: string | null };

export async function deleteCourt(courtId: string): Promise<DeleteCourtState> {
  const userId = await requireUser();
  const { data: uses, error: usesError } = await db()
    .from("club_courts")
    .select("club_id, clubs!inner(name, owner_id, archived_at)")
    .eq("court_id", courtId)
    .eq("clubs.owner_id", userId)
    .overrideTypes<{ club_id: string; clubs: { name: string; archived_at: string | null } }[], { merge: false }>();
  if (usesError) return { error: "Không xóa được. Thử lại sau." };

  const active = uses.filter((u) => !u.clubs.archived_at);
  if (active.length > 0) {
    return { error: `Sân đang được dùng bởi ${active.map((u) => u.clubs.name).join(", ")}. Đổi sân cho CLB trước.` };
  }
  // A deleted (archived) club keeps its money history, not its court.
  if (uses.length > 0) {
    await db()
      .from("club_courts")
      .delete()
      .eq("court_id", courtId)
      .in(
        "club_id",
        uses.map((u) => u.club_id),
      );
  }
  const { error } = await db().from("courts").delete().eq("id", courtId).eq("owner_id", userId);
  if (error) return { error: "Không xóa được. Thử lại sau." };
  revalidatePath("/", "layout");
  redirect("/settings");
}
