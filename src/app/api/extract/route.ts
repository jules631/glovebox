import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExtractedReceiptSchema } from "@/lib/types";
import { SYSTEM_PROMPT } from "@/lib/extraction-prompt";
import { getClientId } from "@/lib/db/client-id";
import { reserveExtraction } from "@/lib/db/garage";

// Per-visitor, and it spends money. Never a cacheable render.
export const dynamic = "force-dynamic";

// Daily caps on the one action that runs a vision model. Overridable by env so
// the ceiling can be tuned without a deploy, but the defaults are deliberately
// low: this is a demo, not a service, and the point is that no visitor can run
// up an unbounded bill.
const PER_CLIENT_DAILY = Number(process.env.EXTRACT_DAILY_PER_CLIENT ?? 15);
const GLOBAL_DAILY = Number(process.env.EXTRACT_DAILY_GLOBAL ?? 50);

// A timeout ceiling, not a budget: an unused second costs nothing. Vision on a
// multi page invoice runs 20 to 40 seconds before any thinking, so the old 60s
// left no margin once adaptive thinking was in the picture. Spend is controlled
// by effort on the request below, not by this number.
export const maxDuration = 300;

const MAX_FILES = 6;
const MAX_TEXT_CHARS = 60_000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

type ImageType = (typeof IMAGE_TYPES)[number];

function isImageType(type: string): type is ImageType {
  return (IMAGE_TYPES as readonly string[]).includes(type);
}

export async function POST(request: Request) {
  // Tie every extraction to a garage cookie (issued here if absent) and hold it
  // to a durable daily cap, per client and across all clients. This is what
  // keeps a public endpoint that runs a vision model from becoming an open door
  // to someone else's API bill.
  const clientId = await getClientId();
  const reservation = await reserveExtraction(clientId, {
    perClientDaily: PER_CLIENT_DAILY,
    globalDaily: GLOBAL_DAILY,
  });
  if (!reservation.ok) {
    const message =
      reservation.reason === "client"
        ? "You have reached today's scan limit. Try again tomorrow."
        : "The demo has reached today's total scan capacity. Try again tomorrow.";
    return Response.json({ error: message }, { status: 429 });
  }

  // Two intake paths through one extractor. Pasted text matters more than it
  // looks: dealers and chains already email invoices, so pasting one removes
  // the camera, the lighting, and the standing-at-the-counter problem entirely.
  // It is also the honest stand in for full email ingestion, which needs an
  // inbound mail service this prototype does not have.
  let files: File[] = [];
  let pastedText = "";
  try {
    const formData = await request.formData();
    files = formData.getAll("files").filter((f): f is File => f instanceof File);
    pastedText = String(formData.get("text") ?? "").trim();
  } catch {
    return Response.json({ error: "Expected multipart form data with files or text." }, { status: 400 });
  }

  if (files.length === 0 && !pastedText) {
    return Response.json({ error: "Paste an invoice, or attach a photo or PDF." }, { status: 400 });
  }
  if (pastedText.length > MAX_TEXT_CHARS) {
    return Response.json({ error: "That text is too long to be one invoice." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return Response.json({ error: `At most ${MAX_FILES} files per scan.` }, { status: 400 });
  }

  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: `${file.name} is too large (20MB max).` }, { status: 400 });
    }
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    if (file.type === "application/pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
    } else if (isImageType(file.type)) {
      blocks.push({ type: "image", source: { type: "base64", media_type: file.type, data } });
    } else {
      return Response.json(
        { error: `${file.name}: unsupported type. Use a photo (JPEG/PNG/WebP) or PDF.` },
        { status: 400 },
      );
    }
  }
  if (pastedText) {
    blocks.push({
      type: "text",
      text: `The following is the text of a service invoice, pasted or forwarded by the vehicle owner. It may include email headers and quoting artifacts; ignore those and extract only the service record.\n\n<invoice>\n${pastedText}\n</invoice>`,
    });
  }

  blocks.push({
    type: "text",
    text: "Extract the service record into the required structure.",
  });

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: blocks }],
      // Thinking is on by default on this model, and effort defaults to high.
      // Extraction is a careful read of a short document, not a hard reasoning
      // problem: medium reconciles a multi page invoice without paying for
      // depth this task never uses. Raise it if the eval shows accuracy loss,
      // which is the whole reason the eval exists.
      output_config: { format: zodOutputFormat(ExtractedReceiptSchema), effort: "medium" },
    });

    if (!response.parsed_output) {
      return Response.json(
        { error: "Couldn't read a service record from that document. Try a clearer photo." },
        { status: 422 },
      );
    }

    return Response.json(response.parsed_output);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "The scanner is busy right now. Try again in a minute." }, { status: 503 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Extraction failed:", error.status, error.message);
      return Response.json({ error: "Extraction failed. Try again, or use a clearer photo." }, { status: 502 });
    }
    throw error;
  }
}
