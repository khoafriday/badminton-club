import "server-only";
import { addDays } from "./dates";
import { planSessionDates, type SchedulePlanInput } from "./schedule-plan";
import { db } from "./supabase";

export type ScheduleRow = SchedulePlanInput & {
  id: string;
  start_time: string;
  end_time: string;
  venue_name: string | null;
};

export type SessionRow = {
  id: string;
  schedule_id: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  venue_name: string | null;
  status: "active" | "cancelled";
  cancel_reason: string | null;
  note: string | null;
};

const SESSION_COLUMNS = "id, schedule_id, session_date, start_time, end_time, venue_name, status, cancel_reason, note";
const SCHEDULE_COLUMNS = "id, weekday, start_time, end_time, venue_name, is_active, effective_from, effective_to, generated_until";

export async function listSchedules(clubId: string): Promise<ScheduleRow[]> {
  const { data, error } = await db()
    .from("session_schedules")
    .select(SCHEDULE_COLUMNS)
    .eq("club_id", clubId)
    .order("weekday")
    .order("start_time");
  if (error) throw error;
  return data;
}

/** LICH-2: creates the sessions of the coming weeks for every active weekly schedule. Safe to run on every visit. */
export async function ensureSessions(clubId: string, today: string): Promise<{ scheduleCount: number }> {
  const schedules = await listSchedules(clubId);
  for (const schedule of schedules) {
    await fillSchedule(clubId, schedule, today);
  }
  return { scheduleCount: schedules.length };
}

async function fillSchedule(clubId: string, schedule: ScheduleRow, today: string) {
  const plan = planSessionDates(schedule, today);
  if (!plan) return;
  if (plan.dates.length > 0) {
    const rows = plan.dates.map((session_date) => ({
      club_id: clubId,
      schedule_id: schedule.id,
      session_date,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      venue_name: schedule.venue_name,
    }));
    // A session already on that date (for example one the admin cancelled) is kept as it is.
    const { error } = await db()
      .from("sessions")
      .upsert(rows, { onConflict: "schedule_id,session_date", ignoreDuplicates: true });
    if (error) throw error;
  }
  const { error } = await db()
    .from("session_schedules")
    .update({ generated_until: plan.generatedUntil })
    .eq("id", schedule.id);
  if (error) throw error;
}

/**
 * After a weekly schedule changes: drop its upcoming sessions that nobody has used yet, then create them again
 * from the new times. Cancelled sessions and sessions with attendance stay.
 */
export async function resyncSchedule(clubId: string, scheduleId: string, today: string): Promise<void> {
  const { data: upcoming, error } = await db()
    .from("sessions")
    .select("id")
    .eq("club_id", clubId)
    .eq("schedule_id", scheduleId)
    .eq("status", "active")
    .gte("session_date", today);
  if (error) throw error;

  const ids = upcoming.map((s) => s.id);
  const used = await sessionsWithData(ids);
  const unused = ids.filter((id) => !used.has(id));
  if (unused.length > 0) {
    const { error: deleteError } = await db().from("sessions").delete().in("id", unused);
    if (deleteError) throw deleteError;
  }

  const { data: schedule, error: scheduleError } = await db()
    .from("session_schedules")
    .update({ generated_until: addDays(today, -1) })
    .eq("id", scheduleId)
    .eq("club_id", clubId)
    .select(SCHEDULE_COLUMNS)
    .single();
  if (scheduleError) throw scheduleError;
  await fillSchedule(clubId, schedule, today);
}

/** Session ids that have attendance or ledger lines, so they may only be cancelled, not deleted (LICH-7). */
export async function sessionsWithData(sessionIds: string[]): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();
  const [attendance, transactions] = await Promise.all([
    db().from("attendance").select("session_id").in("session_id", sessionIds),
    db().from("transactions").select("session_id").in("session_id", sessionIds),
  ]);
  if (attendance.error) throw attendance.error;
  if (transactions.error) throw transactions.error;
  return new Set([...attendance.data, ...transactions.data].map((r) => r.session_id as string));
}

export async function listSessions(clubId: string, from: string, to: string): Promise<SessionRow[]> {
  const { data, error } = await db()
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("club_id", clubId)
    .gte("session_date", from)
    .lte("session_date", to)
    .order("session_date")
    .order("start_time");
  if (error) throw error;
  return data;
}

export async function getSession(clubId: string, sessionId: string): Promise<SessionRow | null> {
  const { data, error } = await db()
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .eq("club_id", clubId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
