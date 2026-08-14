// Extraction accuracy eval.
//
// Everything downstream inherits this error rate: a misread odometer moves every
// warranty limit and every service interval, and a missed warranty term is a
// claim never made. Until this reports a number, "the extractor works" is an
// impression rather than a measurement.
//
// Scores field by field against human-verified ground truth. Only fields listed
// in the .expected.json are scored, so a fixture can assert what someone
// actually checked off the paper and stay silent about the rest.
//
// Run with: ANTHROPIC_API_KEY=... npm run eval

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExtractedReceiptSchema } from "../src/lib/types.ts";
import { SYSTEM_PROMPT } from "../src/lib/extraction-prompt.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = resolve(root, "validation/fixtures");

if (!process.env.ANTHROPIC_API_KEY) {
  console.log("\nANTHROPIC_API_KEY is not set, so no extraction ran.");
  console.log("This eval makes real API calls. Set the key and re-run:\n");
  console.log("  ANTHROPIC_API_KEY=sk-... npm run eval\n");
  console.log(`Fixtures ready to score: ${readdirSync(dir).filter((f) => f.endsWith(".invoice.txt")).length}\n`);
  process.exit(0);
}

const client = new Anthropic();

/** Pull the comparable value for a scored key out of a full extraction. */
function actual(key, r) {
  const v = r.visit;
  switch (key) {
    case "shopName": return v.shop.name;
    case "storeNumber": return v.shop.storeNumber;
    case "lineItemCount": return v.lineItems.length;
    case "total": return v.totals.total;
    case "tax": return v.totals.tax;
    case "brakeLiningCount": return v.diagnostics?.brakeLinings.length ?? 0;
    case "tireTreadCount": return v.diagnostics?.tireTreadDepths.length ?? 0;
    case "rearRightTread": return v.diagnostics?.tireTreadDepths.find((m) => /rear.?right|rr/i.test(m.position))?.value ?? null;
    case "warrantyCount": return v.warranties.length;
    case "warrantyDurations": return v.warranties.map((w) => w.duration);
    case "warrantyMonths": return v.warranties.map((w) => w.months);
    case "warrantyMiles": return v.warranties.map((w) => w.miles);
    case "anyProrated": return v.warranties.some((w) => w.prorated);
    case "hasPartNumber": return v.lineItems.map((li) => li.partNumber).find(Boolean) ?? null;
    default: return v[key];
  }
}

function same(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (typeof a === "string" && typeof b === "string") return a.trim().toLowerCase() === b.trim().toLowerCase();
  return a === b;
}

let scored = 0, correct = 0;
const misses = [];

for (const file of readdirSync(dir).filter((f) => f.endsWith(".invoice.txt"))) {
  const name = file.replace(".invoice.txt", "");
  const text = readFileSync(resolve(dir, file), "utf8");
  const expected = JSON.parse(readFileSync(resolve(dir, `${name}.expected.json`), "utf8"));

  process.stdout.write(`\n${name}: extracting… `);
  const started = Date.now();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `The following is the text of a service invoice.\n\n<invoice>\n${text}\n</invoice>\n\nExtract the service record into the required structure.`,
    }],
    output_config: { format: zodOutputFormat(ExtractedReceiptSchema), effort: "medium" },
  });
  console.log(`${((Date.now() - started) / 1000).toFixed(1)}s`);

  const r = response.parsed_output;
  if (!r) {
    console.log("  FAILED to parse into the schema at all");
    misses.push([name, "whole record", "a valid record", "unparseable"]);
    scored++;
    continue;
  }

  for (const [key, want] of Object.entries(expected.vehicle ?? {})) {
    scored++;
    const got = r.vehicle[key];
    if (same(got, want)) correct++;
    else misses.push([name, `vehicle.${key}`, want, got]);
  }
  for (const [key, want] of Object.entries(expected.visit ?? {})) {
    scored++;
    const got = actual(key, r);
    if (same(got, want)) correct++;
    else misses.push([name, `visit.${key}`, want, got]);
  }
}

console.log(`\n\nField accuracy: ${correct}/${scored} (${((correct / scored) * 100).toFixed(1)}%)`);
if (misses.length) {
  console.log("\nMisses:");
  for (const [fixture, field, want, got] of misses) {
    console.log(`  ${fixture}  ${field}\n    want: ${JSON.stringify(want)}\n    got:  ${JSON.stringify(got)}`);
  }
}
console.log();
process.exit(misses.length ? 1 : 0);
