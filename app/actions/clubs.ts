"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/club";
import { getCourt, setClubCourt } from "@/lib/courts";
import { db } from "@/lib/supabase";

const clubSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên CLB."),
  court_id: z.string().transform((v) => v || null),
});

type ClubValues = { name: string; court_id: string };
export type ClubFormState = { error: string | null; values: ClubValues };

export async function createClub(_prev: ClubFormState, formData: FormData): Promise<ClubFormState> {
  const userId = await requireUser();
  const values: ClubValues = {
    name: String(formData.get("name") ?? ""),
    court_id: String(formData.get("court_id") ?? ""),
  };
  const parsed = clubSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const { name, court_id } = parsed.data;
  if (court_id && !(await getCourt(userId, court_id))) return { error: "Sân này không còn. Chọn sân khác.", values };

  await db().from("profiles").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
  const { data: club, error } = await db().from("clubs").insert({ name, owner_id: userId }).select("id").single();
  if (error) return { error: "Không tạo được CLB. Thử lại sau.", values };

  // Prices start at 0; they are set on the Settings screen.
  await db().from("club_settings").insert({ club_id: club.id });
  if (court_id) await setClubCourt(club.id, court_id);
  await db().from("profiles").update({ last_club_id: club.id, updated_at: new Date().toISOString() }).eq("id", userId);
  // Every screen showed the create-club form until now; re-render them with the new club.
  revalidatePath("/", "layout");
  if (formData.get("redirect_to") === "/settings") redirect("/settings");
  return { error: null, values };
}
