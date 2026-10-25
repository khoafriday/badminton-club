import "server-only";
import { fundSummary, type Transaction } from "./billing";
import { AUTO_CATEGORY_CODES, categoryLabel } from "./categories";
import { db } from "./supabase";

export type TxRow = {
  id: string;
  type: "income" | "expense";
  amount: number;
  occurredOn: string;
  description: string | null;
  category: string;
  source: "manual" | "attendance" | "membership_fee";
  sessionId: string | null;
};

export type CategoryOption = { id: string; type: "income" | "expense"; label: string };

/** QUY-3: every ledger line of the club, newest first. A club keeps a few thousand lines at most. */
export async function listTransactions(clubId: string): Promise<TxRow[]> {
  const { data, error } = await db()
    .from("transactions")
    .select("id, type, amount, occurred_on, description, source_type, session_id, transaction_categories(code, name)")
    .eq("club_id", clubId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (
    data as unknown as {
      id: string;
      type: "income" | "expense";
      amount: number;
      occurred_on: string;
      description: string | null;
      source_type: TxRow["source"];
      session_id: string | null;
      transaction_categories: { code: string | null; name: string | null };
    }[]
  ).map((t) => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    occurredOn: t.occurred_on,
    description: t.description,
    category: categoryLabel(t.transaction_categories),
    source: t.source_type,
    sessionId: t.session_id,
  }));
}

export function summarize(rows: TxRow[], range: { from: string | null; to: string | null }) {
  const txs: Transaction[] = rows.map((r) => ({ type: r.type, amount: r.amount, occurredOn: r.occurredOn }));
  return { period: fundSummary(txs, range), allTime: fundSummary(txs) };
}

/** Categories that can be picked by hand: the shared defaults plus the club's own, minus the automatic ones. */
export async function listCategories(clubId: string): Promise<CategoryOption[]> {
  const { data, error } = await db()
    .from("transaction_categories")
    .select("id, type, code, name, club_id")
    .or(`club_id.is.null,club_id.eq.${clubId}`)
    .order("created_at");
  if (error) throw error;
  return data
    .filter((c) => !AUTO_CATEGORY_CODES.includes(c.code ?? ""))
    .map((c) => ({ id: c.id, type: c.type, label: categoryLabel(c) }));
}
