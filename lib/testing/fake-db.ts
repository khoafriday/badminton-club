// A tiny in-memory stand-in for the supabase-js query builder, enough for lib/fees.ts and lib/debts.ts.
// It knows eq/lt/lte/gt/in filters, "members!inner(...)" joins, insert/upsert/update/delete and count heads.

type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

let nextId = 1;

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private mode: "select" | "update" | "upsert" | "delete" = "select";
  private patch: Row = {};
  private joins: string[] = [];
  private head = false;

  constructor(
    private tables: Tables,
    private table: string,
  ) {}

  select(columns = "*", opts?: { head?: boolean }) {
    this.joins = [...columns.matchAll(/(\w+)!inner\(/g)].map((m) => m[1]);
    this.head = Boolean(opts?.head);
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
    this.patch = patch;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  upsert(rows: Row[], opts: { onConflict: string; ignoreDuplicates?: boolean }) {
    const keys = opts.onConflict.split(",");
    for (const row of rows) {
      const clash = this.rows().find((r) => keys.every((k) => r[k] === row[k]));
      if (clash && !opts.ignoreDuplicates) Object.assign(clash, row);
      if (!clash) this.rows().push({ id: `id-${nextId++}`, payment_status: "unpaid", waive_reason: null, ...row });
    }
    this.mode = "upsert";
    return this;
  }
  private where(column: string, test: (v: unknown) => boolean) {
    const [joined, field] = column.includes(".") ? column.split(".") : [null, column];
    this.filters.push((r) => {
      if (!joined) return test(r[field]);
      const linked = this.link(joined, r);
      return linked !== undefined && test(linked[field]);
    });
    return this;
  }
  eq(c: string, v: unknown) {
    return this.where(c, (x) => x === v);
  }
  lt(c: string, v: string) {
    return this.where(c, (x) => String(x) < v);
  }
  lte(c: string, v: string) {
    return this.where(c, (x) => String(x) <= v);
  }
  gte(c: string, v: string) {
    return this.where(c, (x) => String(x) >= v);
  }
  gt(c: string, v: number | string) {
    return this.where(c, (x) => (typeof v === "number" ? Number(x) > v : String(x) > v));
  }
  in(c: string, vs: unknown[]) {
    return this.where(c, (x) => vs.includes(x));
  }

  private rows() {
    return (this.tables[this.table] ??= []);
  }
  private link(name: string, r: Row) {
    // "members" via member_id, "sessions" via session_id.
    const key = `${name.replace(/s$/, "")}_id`;
    return this.tables[name]?.find((x) => x.id === r[key]);
  }
  private run() {
    if (this.mode === "upsert") return { data: null, error: null };
    const hits = this.rows().filter((r) => this.joins.every((j) => this.link(j, r)) && this.filters.every((f) => f(r)));
    if (this.mode === "delete") {
      this.tables[this.table] = this.rows().filter((r) => !hits.includes(r));
      return { data: null, error: null };
    }
    if (this.mode === "update") {
      hits.forEach((r) => Object.assign(r, this.patch));
      return { data: null, error: null };
    }
    if (this.head) return { data: null, error: null, count: hits.length };
    const data = hits.map((r) => ({ ...r, ...Object.fromEntries(this.joins.map((j) => [j, this.link(j, r)])) }));
    return { data, error: null };
  }
  then<T>(resolve: (v: ReturnType<Query["run"]>) => T, reject?: (e: unknown) => T) {
    try {
      return Promise.resolve(resolve(this.run()));
    } catch (e) {
      return reject ? Promise.resolve(reject(e)) : Promise.reject(e);
    }
  }
}

export function fakeDb(tables: Tables) {
  return { from: (table: string) => new Query(tables, table) };
}
