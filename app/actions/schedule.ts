"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listClubs, requireClub, todayInVietnam } from "@/lib/club";
import { getCourt } from "@/lib/courts";
import {
  firstError,
  readForm,
  scheduleSchema,
  sessionSchema,
  type ScheduleFormValues,
  type SessionFormValues,
} from "@/lib/schedule-forms";
import { resyncSchedule, sessionsWithData } from "@/lib/schedule";
import { db } from "@/lib/supabase";

const SCHEDULE_KEYS = ["weekday", "start_time", "end_time", "court_id"] as const;
const SESSION_KEYS = ["session_date", "start_time", "end_time", "court_id", "note"] as const;
const SAVE_FAILED = "Không lưu được. Thử lại sau.";
const COURT_GONE = "Sân này không còn. Chọn sân khác.";

/** False when the picked court is not one of the user's courts (for example deleted in another tab). */
async function courtAllowed(userId: string, courtId: string | null): Promise<boolean> {
  return courtId === null || (await getCourt(userId, courtId)) !== null;
}

export type ScheduleFormState = { error: string | null; values: ScheduleFormValues };
export type SessionFormState = { error: string | null; values: SessionFormValues };

function refreshSchedulePages() {
  revalidatePath("/", "layout");
}

// LICH-1: a weekly slot. Its sessions for the coming weeks are created straight away.
export async function createSchedule(_prev: ScheduleFormState, formData: FormData): Promise<ScheduleFormState> {
  const { userId, club } = await requireClub();
  const values = readForm(formData, SCHEDULE_KEYS);
  const parsed = scheduleSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };
  if (!(await courtAllowed(userId, parsed.data.court_id))) return { error: COURT_GONE, values };

  const today = todayInVietnam();
  const { data, error } = await db()
    .from("session_schedules")
    .insert({ ...parsed.data, club_id: club.id, effective_from: today })
    .select("id")
    .single();
  if (error) return { error: SAVE_FAILED, values };
  await resyncSchedule(club.id, data.id, today);
  refreshSchedulePages();
  redirect("/schedule/weekly");
}

export async function updateSchedule(
  scheduleId: string,
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const { userId, club } = await requireClub();
  const values = readForm(formData, SCHEDULE_KEYS);
  const parsed = scheduleSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };
  if (!(await courtAllowed(userId, parsed.data.court_id))) return { error: COURT_GONE, values };

  const { error } = await db()
    .from("session_schedules")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", scheduleId)
    .eq("club_id", club.id);
  if (error) return { error: SAVE_FAILED, values };
  await resyncSchedule(club.id, scheduleId, todayInVietnam());
  refreshSchedulePages();
  redirect("/schedule/weekly");
}

/** Pause or resume a weekly slot. Pausing removes its upcoming sessions that nobody has used yet. */
export async function setScheduleActive(scheduleId: string, active: boolean) {
  const { club } = await requireClub();
  await db()
    .from("session_schedules")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", scheduleId)
    .eq("club_id", club.id);
  await resyncSchedule(club.id, scheduleId, todayInVietnam());
  refreshSchedulePages();
  redirect("/schedule/weekly");
}

// LICH-5: a one-off session outside the weekly schedule.
export async function createSession(_prev: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const { userId, club: current } = await requireClub();
  const values: SessionFormValues = { ...readForm(formData, SESSION_KEYS), club_id: String(formData.get("club_id") ?? "") };
  const parsed = sessionSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };
  if (!(await courtAllowed(userId, parsed.data.court_id))) return { error: COURT_GONE, values };
  // From Lịch "Tất cả" the session can be for another club; only the user's own clubs are allowed.
  const club = values.club_id ? (await listClubs(userId)).find((c) => c.id === values.club_id) : current;
  if (!club) return { error: "CLB này không còn. Chọn CLB khác.", values };

  const { error } = await db()
    .from("sessions")
    .insert({ ...parsed.data, club_id: club.id });
  if (error) return { error: SAVE_FAILED, values };
  // Lịch shows the current club, so it becomes the one the session was added to.
  if (club.id !== current.id) {
    await db().from("profiles").update({ last_club_id: club.id, updated_at: new Date().toISOString() }).eq("id", userId);
  }
  refreshSchedulePages();
  redirect(`/schedule?date=${parsed.data.session_date}`);
}

// LICH-4: change the date, time or court of one session.
export async function updateSession(
  sessionId: string,
  _prev: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const { userId, club } = await requireClub();
  const values = readForm(formData, SESSION_KEYS);
  const parsed = sessionSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };
  if (!(await courtAllowed(userId, parsed.data.court_id))) return { error: COURT_GONE, values };

  const { error } = await db()
    .from("sessions")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("club_id", club.id);
  // The only unique rule on sessions: one session per weekly slot per day.
  if (error?.code === "23505") return { error: "Lịch cố định này đã có buổi vào ngày đó.", values };
  if (error) return { error: SAVE_FAILED, values };
  refreshSchedulePages();
  redirect(`/schedule?date=${parsed.data.session_date}`);
}

// LICH-6: cancel or restore a session.
export async function setSessionCancelled(sessionId: string, cancelled: boolean, formData: FormData) {
  const { club } = await requireClub();
  const reason = String(formData.get("cancel_reason") ?? "").trim();
  await db()
    .from("sessions")
    .update({
      status: cancelled ? "cancelled" : "active",
      cancel_reason: cancelled ? reason || null : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("club_id", club.id);
  refreshSchedulePages();
}

export type DeleteSessionState = { error: string | null };

// LICH-7: only a session with no attendance or money may be deleted.
export async function deleteSession(sessionId: string): Promise<DeleteSessionState> {
  const { club } = await requireClub();
  if ((await sessionsWithData([sessionId])).size > 0) {
    return { error: "Buổi đã có điểm danh hoặc tiền, chỉ có thể Hủy." };
  }
  const { error } = await db().from("sessions").delete().eq("id", sessionId).eq("club_id", club.id);
  if (error) return { error: "Không xóa được. Thử lại sau." };
  refreshSchedulePages();
  redirect("/schedule");
}
