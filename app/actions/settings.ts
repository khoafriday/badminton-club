"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireClub, requireUser } from "@/lib/club";
import { getCourt, setClubCourt } from "@/lib/courts";
import { parseVnd } from "@/lib/money";
import { db } from "@/lib/supabase";

const clubInfoSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên CLB."),
  court_id: z.string().transform((v) => v || null),
});

type ClubInfoValues = { name: string; court_id: string };
export type ClubInfoState = { error: string | null; saved: boolean; values: ClubInfoValues };

export async function updateClubInfo(_prev: ClubInfoState, formData: FormData): Promise<ClubInfoState> {
  const { userId, club } = await requireClub();
  const values: ClubInfoValues = {
    name: String(formData.get("name") ?? ""),
    court_id: String(formData.get("court_id") ?? ""),
  };
  const parsed = clubInfoSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, saved: false, values };
  const { name, court_id } = parsed.data;
  if (court_id && !(await getCourt(userId, court_id))) {
    return { error: "Sân này không còn. Chọn sân khác.", saved: false, values };
  }

  const { error } = await db().from("clubs").update({ name, updated_at: new Date().toISOString() }).eq("id", club.id);
  if (error) return { error: "Không lưu được. Thử lại sau.", saved: false, values };
  try {
    await setClubCourt(club.id, court_id);
  } catch {
    return { error: "Không lưu được sân. Thử lại sau.", saved: false, values };
  }
  revalidatePath("/", "layout");
  return { error: null, saved: true, values };
}

const PRICE_FIELDS = ["monthly_fee_male", "monthly_fee_female", "guest_price_male", "guest_price_female"] as const;
type PriceValues = Record<(typeof PRICE_FIELDS)[number], string>;
export type PricesState = { error: string | null; saved: boolean; values: PriceValues };

// GIA-4: only new sessions and new fee slips use these prices; saved amounts are never recalculated.
export async function updatePrices(_prev: PricesState, formData: FormData): Promise<PricesState> {
  const { club } = await requireClub();
  const values = Object.fromEntries(PRICE_FIELDS.map((f) => [f, String(formData.get(f) ?? "")])) as PriceValues;
  const amounts: Record<string, number> = {};
  for (const field of PRICE_FIELDS) {
    const amount = parseVnd(values[field]);
    if (amount === null) return { error: "Giá chỉ gồm chữ số, ví dụ 300.000.", saved: false, values };
    amounts[field] = amount;
  }

  const { error } = await db()
    .from("club_settings")
    .upsert({ club_id: club.id, ...amounts, updated_at: new Date().toISOString() }, { onConflict: "club_id" });
  if (error) return { error: "Không lưu được. Thử lại sau.", saved: false, values };
  revalidatePath("/", "layout");
  return { error: null, saved: true, values };
}

export async function switchClub(clubId: string) {
  const userId = await requireUser();
  // owner_id check: only switch to a club this login owns.
  const { data } = await db().from("clubs").select("id").eq("id", clubId).eq("owner_id", userId).maybeSingle();
  if (data) {
    await db().from("profiles").update({ last_club_id: clubId, updated_at: new Date().toISOString() }).eq("id", userId);
  }
  revalidatePath("/", "layout");
}

/** CLB-1 "xóa": the club is archived, so its money history stays in the database. */
export async function archiveClub() {
  const { userId, club } = await requireClub();
  await db().from("clubs").update({ archived_at: new Date().toISOString() }).eq("id", club.id).eq("owner_id", userId);
  await db().from("profiles").update({ last_club_id: null }).eq("id", userId);
  revalidatePath("/", "layout");
  redirect("/settings");
}
