import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The browser never talks to Supabase. Every query runs on the server with the service role key,
// which bypasses RLS, so each query must filter by club_id itself.
let client: SupabaseClient | null = null;

const DB_ENV_NAMES = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

/** Names of the Supabase variables that are missing or blank on this deployment. */
export function missingDatabaseEnv(): string[] {
  return DB_ENV_NAMES.filter((name) => !process.env[name]?.trim());
}

export function isDatabaseConfigured(): boolean {
  return missingDatabaseEnv().length === 0;
}

export function db(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
