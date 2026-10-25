import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The browser never talks to Supabase. Every query runs on the server with the service role key,
// which bypasses RLS, so each query must filter by club_id itself.
let client: SupabaseClient | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function db(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
