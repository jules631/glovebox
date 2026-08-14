import { after } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExtractedReceiptSchema } from "@/lib/types";
import { SYSTEM_PROMPT } from "@/lib/extraction-prompt";
import {
  normalizeInbound,
  resolveAliasToken,
  type PostmarkInbound,
} from "@/lib/inbound/postmark";
import {
  failInbound,
  garageIdByAliasToken,
  recordInbound,
  resolveInbound,
  saveReceiptForGarage,
} from "@/lib/db/garage";

// The other half of the Glovebox address: Postmark posts every mail sent to
// u-<token>@<domain> here. The contract with the mail provider is "answer
// fast, retry on failure", and extraction takes tens of seconds, so the mail
// is recorded first, the response returns immediately, and the model runs
// after the response is flushed. A failed extraction is a visible row, never
// lost mail.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  // Postmark does not sign inbound webhooks; the shared secret in the URL is
  // the standard guard. Without it configured, refuse everything: an open
  // endpoint that writes to garages is worse than no endpoint.
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  const given = new URL(request.url).searchParams.get("secret");
  if (!secret || given !== secret) {
    return Response.json({ error: "Not authorized." }, { status: 401 });
  }

  let mail: PostmarkInbound;
  try {
    mail = (await request.json()) as PostmarkInbound;
  } catch {
    return Response.json({ error: "Expected Postmark JSON." }, { status: 400 });
  }

  const token = resolveAliasToken(mail);
  if (!token) {
    // Not addressed to any alias. 200 rather than an error: Postmark would
    // retry a failure forever, and there is nothing here to retry into.
    return Response.json({ ignored: "no alias token in recipients" });
  }

  const gid = await garageIdByAliasToken(token);
  if (!gid) {
    return Response.json({ ignored: "unknown alias" });
  }

  const normalized = normalizeInbound(mail);
  if (!normalized.text && !normalized.pdfAttachments.length && !normalized.imageAttachments.length) {
    return Response.json({ ignored: "empty message" });
  }

  const inboundId = await recordInbound(gid, normalized.fromEmail, normalized.subject);

  // Acknowledge now; extract after the response is on the wire.
  after(async () => {
    try {
      const client = new Anthropic();
      const blocks: Anthropic.ContentBlockParam[] = [];

      for (const pdf of normalized.pdfAttachments.slice(0, 4)) {
        blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.base64 } });
      }
      for (const img of normalized.imageAttachments.slice(0, 4)) {
        blocks.push({
          type: "image",
          source: { type: "base64", media_type: img.contentType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: img.base64 },
        });
      }
      if (normalized.text) {
        blocks.push({
          type: "text",
          text: `The following is the text of a service invoice a shop emailed to the vehicle owner. Ignore any email furniture that survived cleanup.\n\n<invoice>\n${normalized.text.slice(0, 60_000)}\n</invoice>`,
        });
      }
      blocks.push({ type: "text", text: "Extract the service record into the required structure." });

      const response = await client.messages.parse({
        model: "claude-opus-5",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: blocks }],
        output_config: { format: zodOutputFormat(ExtractedReceiptSchema), effort: "medium" },
      });

      if (!response.parsed_output) {
        await failInbound(inboundId, "Extraction produced no readable service record.");
        return;
      }

      const { visitId } = await saveReceiptForGarage(gid, response.parsed_output, {
        // Mail sent by the shop's own system is the strongest tier the product
        // accepts, and the whole point of the address.
        intakeMethod: normalized.pdfAttachments.length ? "pdf" : "shop_email",
        hasSourceDocument: normalized.pdfAttachments.length + normalized.imageAttachments.length > 0,
      });
      await resolveInbound(inboundId, visitId);
    } catch (error) {
      console.error("Inbound processing failed:", error);
      await failInbound(inboundId, error instanceof Error ? error.message : "Unknown failure");
    }
  });

  return Response.json({ accepted: inboundId });
}
