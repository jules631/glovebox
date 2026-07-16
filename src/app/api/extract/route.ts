import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExtractedReceiptSchema } from "@/lib/types";

// Opus vision on a multi-page receipt can take 20-40s.
export const maxDuration = 60;

const MAX_FILES = 6;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

// Cheap abuse guard for an unauthenticated route. In-memory is fine for a
// demo: worst case a new serverless instance resets the count.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

const SYSTEM_PROMPT = `You are an expert automotive service-record extractor. You read repair shop invoices, work orders, and point-of-sale receipts (Pep Boys, Goodyear, dealers, independent shops) and produce one structured service record.

Rules:
- Never invent a value. If a field is not present or unreadable, return null (or an empty array).
- Normalize all dates to ISO format (YYYY-MM-DD).
- The odometer reading may be labeled "Mileage In/Out", "Odometer", or similar. Use the mileage at time of service.
- Classify every line item as "part", "labor", "fee" (shop fees, disposal fees, taxes listed as line items), or "other". Attribute the technician who performed it when the document says so.
- Package line items (e.g. an oil change package) should be broken into their components when the document itemizes them.
- Parse inspection measurements when present: brake linings, rotor thickness, tire tread depths, per corner (front-left, front-right, rear-left, rear-right). US inspection sheets usually measure in 32nds of an inch.
- Extract warranty terms: condense the language faithfully into "description", and pull structured months/miles bounds when stated (e.g. "6 months or 6,000 miles" -> months: 6, miles: 6000). Note what each term applies to and whether it covers parts, labor, or both. Include exclusions in the description when they matter (e.g. "excludes brake pads").
- If multiple images are provided they are pages of the same document or two documents for the same visit (invoice + payment receipt). Produce ONE record and reconcile totals across them.
- Use extractionNotes to flag judgment calls or ambiguities for the human reviewing (e.g. "line items did not sum to the printed total; kept the printed total").`;

type ImageType = (typeof IMAGE_TYPES)[number];

function isImageType(type: string): type is ImageType {
  return (IMAGE_TYPES as readonly string[]).includes(type);
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return Response.json(
      { error: "Too many scans in the last hour. Try again a bit later." },
      { status: 429 },
    );
  }

  let files: File[];
  try {
    const formData = await request.formData();
    files = formData.getAll("files").filter((f): f is File => f instanceof File);
  } catch {
    return Response.json({ error: "Expected multipart form data with files." }, { status: 400 });
  }

  if (files.length === 0) {
    return Response.json({ error: "Attach at least one receipt photo or PDF." }, { status: 400 });
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
  blocks.push({
    type: "text",
    text: "Extract the service record from this receipt into the required structure.",
  });

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: blocks }],
      output_config: { format: zodOutputFormat(ExtractedReceiptSchema) },
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
