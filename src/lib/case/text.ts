// Shared text helpers for the deterministic primitives. Kept separate so the
// citation guard and the chunker normalize identically.

/** Lowercase, collapse whitespace, strip most punctuation. Used for matching. */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s.$/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Does `haystack` contain `needle` after normalization? */
export function looseIncludes(haystack: string, needle: string): boolean {
  const h = normalizeForMatch(haystack);
  const n = normalizeForMatch(needle);
  return n.length > 0 && h.includes(n);
}

// Page furniture and boilerplate a cited chunk must never be: headers, dotted
// leaders, legal footers. "A chunk cited as evidence must contain operative
// language, not headings or dotted page listings."
const FURNITURE = [
  /^invoice\b.*customer copy/i,
  /^page \d+/i,
  /need a tow/i,
  /^\s*x\s*$/i,
  /storage charges:/i,
  /i hereby authorize/i,
  /limited warrant/i, // the block heading; specific warranty terms are kept by the tagger
  /^\.{3,}/,
  /^[-_\s]{4,}$/,
];

export function isFurniture(line: string): boolean {
  const t = line.trim();
  if (t.length < 2) return true;
  return FURNITURE.some((re) => re.test(t));
}
