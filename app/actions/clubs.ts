"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/club";
import { db } from "@/lib/supabase";

const clubSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên CLB."),
  venue_name: z
    .string()
    .trim()
    .transform((v) => v || null),
  venue_address: z
    .string()
    .trim()
    .transform((v) => v || null),
});

type ClubValues = { name: string; venue_name: string; venue_address: string };
export type ClubFormState = { error: string | null; values: ClubValues };

export async function createClub(_prev: ClubFormState, formData: FormData): Promise<ClubFormState> {
  const userId = await requireUser();
  const values: ClubValues = {
    name: String(formData.get("name") ?? ""),
    venue_name: String(formData.get("venue_name") ?? ""),
    venue_address: String(formData.get("venue_address") ?? ""),
  };
  const parsed = clubSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  await db().from("profiles").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
  const { data: club, error } = await db()
    .from("clubs")
    .insert({ ...parsed.data, owner_id: userId })
    .select("id")
    .single();
  if (error) return { error: "Không tạo được CLB. Thử lại sau.", values };

  // Prices start at 0; they are set on the Settings screen.
  await db().from("club_settings").insert({ club_id: club.id });
  await db().from("profiles").update({ last_club_id: club.id, updated_at: new Date().toISOString() }).eq("id", userId);
  // Every screen showed the create-club form until now; re-render them with the new club.
  revalidatePath("/", "layout");
  return { error: null, values };
}
