import type { Chunk, Transcript } from "./types";
import { isFurniture } from "./text";

// Chunk and tag source evidence by structure. Known structure first: no vector
// search when the document already has a shape. A chunk cited as evidence must
// contain operative language, so page furniture and boilerplate headings are
// dropped here rather than left for the guard to trip over.
//
// Tagging is heuristic and domain-light: it keys off the profile's structure
// tags via keyword hints. The model does the precise extraction downstream;
// this stage just routes operative lines into buckets so the guard cites the
// right kind of span.

const TAG_HINTS: Record<string, RegExp> = {
  vehicle: /\b(vin|year|make|model|mileage|odometer|license|plate|engine)\b/i,
  line_items: /\b(oil change|filter|rotation|synthetic|brake|tire|shop fee|each|qty)\b/i,
  totals: /\b(tax|total|tender|sub-?total|visa|amex|mastercard|payment)\b/i,
  inspection: /\b(tread|lining|rotor|drum|32nds|brake friction|depth)\b/i,
  warranty: /\b(warrant|6,?000 miles|90 days|3,?000 miles|12 months|replace.*free|defect|fail within)\b/i,
};

// Precedence is fixed here, independent of the profile's array order: the most
// specific structure (legal warranty language, measurements) wins over generic
// buckets, so "Installed parts replaced free..." tags as warranty, not totals.
const TAG_PRECEDENCE = ["warranty", "inspection", "line_items", "totals", "vehicle"];

export function chunk(transcript: Transcript, structureTags: string[]): Chunk[] {
  const active = new Set(structureTags);
  const order = TAG_PRECEDENCE.filter((tag) => active.has(tag) && TAG_HINTS[tag]);

  const chunks: Chunk[] = [];
  for (const line of transcript.lines) {
    if (isFurniture(line.text)) continue;
    const tag = order.find((t) => TAG_HINTS[t].test(line.text)) ?? "other";
    chunks.push({ anchor: line.anchor, tag, text: line.text.trim() });
  }
  return chunks;
}

/** Operative chunks only (drops the "other" bucket), for feeding the guard. */
export function operativeChunks(chunks: Chunk[]): Chunk[] {
  return chunks.filter((c) => c.tag !== "other");
}
