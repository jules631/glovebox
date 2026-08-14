import { z } from "zod";
import { getClientId } from "@/lib/db/client-id";
import { saveReceipt } from "@/lib/db/garage";
import { ExtractedReceiptSchema } from "@/lib/types";

// Per-visitor data, and writes. Never a cacheable render.
export const dynamic = "force-dynamic";

// The client says how the record arrived, but never when it was recorded.
// recorded_at is the database's to assign, because record age is the one thing
// a buyer can lean on and a seller must not be able to manufacture.
const BodySchema = z.object({
  receipt: ExtractedReceiptSchema,
  vehicleId: z.string().optional(),
  receiptThumbnail: z.string().nullable().optional(),
  intakeMethod: z.enum(["shop_email", "pdf", "photo", "owner_entry"]),
  hasSourceDocument: z.boolean().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "That record is not in a shape we can save.", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const clientId = await getClientId();
    const { receipt, ...options } = parsed.data;
    return Response.json(await saveReceipt(clientId, receipt, options));
  } catch (error) {
    console.error("Failed to save visit:", error);
    return Response.json({ error: "Could not save that record." }, { status: 500 });
  }
}
