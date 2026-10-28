import { revalidatePath } from "next/cache";
import { parseSepayBody, sepayKeyMatches, settleTransfer } from "@/lib/sepay";

/**
 * SePay calls this when money moves on the club's TPBank account. proxy.ts lets it through without a login;
 * the API key in the Authorization header is what proves the call is SePay's. SePay retries on anything but 2xx.
 */
export async function POST(request: Request) {
  if (!sepayKeyMatches(request.headers.get("authorization"))) {
    return Response.json({ success: false }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false }, { status: 400 });
  }
  const transfer = parseSepayBody(body);
  // Money going out, or a body we cannot read: nothing to do, and no point in SePay retrying.
  if (!transfer) return Response.json({ success: true });

  const outcome = await settleTransfer(transfer, body);
  if (outcome !== "ignored" && outcome !== "duplicate") revalidatePath("/", "layout");
  return Response.json({ success: true, outcome });
}
