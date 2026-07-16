import type { CaseRecord, Citation, ReviewQuestion } from "./types";

// Reconcile shared facts across sources before drafting. When the same tracked
// fact appears in more than one document, compare the values; every mismatch
// becomes a named review question a human answers, never a silent guess.
//
// The real Pep Boys pair proves why this matters: the invoice dates the visit
// 2026-07-07, the point-of-sale receipt 2026-07-15. Same work order, same total.
// That disagreement should reach the user as a question, not be resolved by
// whichever record happened to be processed last.

/** Pull a tracked fact's value + provenance from a record, if it carries one. */
function factFrom(record: CaseRecord, fact: string): { value: string; citation?: Citation } | null {
  const payload = record.payload as Record<string, unknown>;
  const raw = payload?.[fact];
  if (raw == null || raw === "") return null;
  const citation = record.citations.find((c) => c.field === fact);
  return { value: String(raw), citation };
}

function normalizeValue(fact: string, value: string): string {
  // Compare tracked numeric/date facts by their canonical form so that
  // "$145.44" and "145.44" don't read as a disagreement.
  const trimmed = value.trim();
  if (/total|amount|price|cost/i.test(fact)) {
    const n = parseFloat(trimmed.replace(/[^0-9.]/g, ""));
    return Number.isNaN(n) ? trimmed.toLowerCase() : n.toFixed(2);
  }
  return trimmed.toLowerCase();
}

export function reconcile(records: CaseRecord[], trackedFacts: string[]): ReviewQuestion[] {
  const questions: ReviewQuestion[] = [];

  for (const fact of trackedFacts) {
    // documentId -> asserted value (first occurrence per document wins)
    const byDoc = new Map<string, string>();
    for (const record of records) {
      if (byDoc.has(record.documentId)) continue;
      const f = factFrom(record, fact);
      if (f) byDoc.set(record.documentId, f.value);
    }
    if (byDoc.size < 2) continue; // need at least two sources to disagree

    const distinct = new Set([...byDoc.values()].map((v) => normalizeValue(fact, v)));
    if (distinct.size <= 1) continue; // sources agree

    questions.push({
      fact,
      question: `Sources disagree on ${humanFact(fact)}. Which one governs?`,
      sources: Object.fromEntries(byDoc),
      governingSource: null,
    });
  }

  return questions;
}

function humanFact(fact: string): string {
  return fact.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").toLowerCase().trim();
}
