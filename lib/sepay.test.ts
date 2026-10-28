import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
const rpc = vi.fn(async (): Promise<{ data: string | null; error: { message: string } | null }> => ({
  data: "matched",
  error: null,
}));

// Just the calls settleTransfer makes: select ... in/eq, and insert ... select ... single with a unique key.
function from(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let inserted: Row | null = null;
  let clash = false;
  let deleting = false;
  const q = {
    select: () => q,
    in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), q),
    eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
    delete: () => ((deleting = true), q),
    insert: (row: Row) => {
      clash = tables[table].some((r) => r.provider === row.provider && r.provider_tx_id === row.provider_tx_id);
      if (!clash) tables[table].push((inserted = { id: `tx-${tables[table].length + 1}`, ...row }));
      return q;
    },
    single: () => q,
    then: (resolve: (v: unknown) => unknown) => {
      if (deleting) {
        tables[table] = tables[table].filter((r) => !filters.every((f) => f(r)));
        return resolve({ error: null });
      }
      return resolve(
        clash
          ? { data: null, error: { code: "23505" } }
          : inserted
            ? { data: inserted, error: null }
            : { data: tables[table].filter((r) => filters.every((f) => f(r))), error: null },
      );
    },
  };
  return q;
}
vi.mock("./supabase", () => ({ db: () => ({ from, rpc }) }));

const { parseSepayBody, sepayKeyMatches, settleTransfer } = await import("./sepay");

const body = {
  id: 92704,
  gateway: "TPBank",
  transactionDate: "2026-10-28 14:02:37",
  accountNumber: "00012345678",
  code: null,
  content: "NGUYEN VAN A chuyen tien BC7K2QX9",
  transferType: "in",
  transferAmount: 350000,
  accumulated: 19077000,
  subAccount: null,
  referenceCode: "MBVCB.3278907687",
  description: "",
};

describe("parseSepayBody", () => {
  it("reads an incoming transfer in Vietnam time", () => {
    expect(parseSepayBody(body)).toEqual({
      providerTxId: "92704",
      accountNo: "00012345678",
      amount: 350000,
      content: "NGUYEN VAN A chuyen tien BC7K2QX9",
      occurredAt: "2026-10-28T14:02:37+07:00",
    });
  });
  it("skips money going out and bodies that are not SePay's", () => {
    expect(parseSepayBody({ ...body, transferType: "out" })).toBeNull();
    expect(parseSepayBody({ ...body, transferAmount: "abc" })).toBeNull();
    expect(parseSepayBody(null)).toBeNull();
  });
});

describe("sepayKeyMatches", () => {
  beforeEach(() => vi.stubEnv("SEPAY_WEBHOOK_KEY", "secret-key"));
  afterEach(() => vi.unstubAllEnvs());
  it("takes only the configured key", () => {
    expect(sepayKeyMatches("Apikey secret-key")).toBe(true);
    expect(sepayKeyMatches("Apikey wrong")).toBe(false);
    expect(sepayKeyMatches(null)).toBe(false);
  });
  it("refuses everything while no key is set", () => {
    vi.stubEnv("SEPAY_WEBHOOK_KEY", "");
    expect(sepayKeyMatches("Apikey ")).toBe(false);
  });
});

describe("settleTransfer", () => {
  const transfer = parseSepayBody(body)!;
  beforeEach(() => {
    rpc.mockClear();
    tables = {
      payment_requests: [{ id: "req-1", club_id: "club-1", code: "BC7K2QX9" }],
      club_settings: [{ club_id: "club-1", bank_account_no: "00012345678" }],
      bank_transactions: [],
    };
  });

  it("stores the transfer and settles it against its QR", async () => {
    expect(await settleTransfer(transfer, body)).toBe("matched");
    expect(tables.bank_transactions).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("confirm_payment_request", { p_request_id: "req-1", p_bank_tx_id: "tx-1" });
  });

  it("settles a transfer reported twice only once", async () => {
    await settleTransfer(transfer, body);
    expect(await settleTransfer(transfer, body)).toBe("duplicate");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("does not store other money on the account", async () => {
    expect(await settleTransfer({ ...transfer, content: "tra tien an trua" }, body)).toBe("ignored");
    expect(tables.bank_transactions).toHaveLength(0);
  });

  it("keeps a code with no QR for the admin, without paying anything", async () => {
    expect(await settleTransfer({ ...transfer, content: "BCZZZZZZ" }, body)).toBe("unmatched");
    expect(tables.bank_transactions[0]).toMatchObject({ club_id: "club-1", content: "BCZZZZZZ" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("pays nothing when the money went to another account", async () => {
    expect(await settleTransfer({ ...transfer, accountNo: "999999" }, body)).toBe("unmatched");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("lets SePay's retry settle a transfer when settling failed", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "timeout" } });
    await expect(settleTransfer(transfer, body)).rejects.toBeTruthy();
    expect(tables.bank_transactions).toHaveLength(0);
    expect(await settleTransfer(transfer, body)).toBe("matched");
  });
});
