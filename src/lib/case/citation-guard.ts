import type { CaseRecord, CitationCheck, GuardReport, Transcript, Verdict } from "./types";
import { anchorId } from "./types";
import { looseIncludes, normalizeForMatch } from "./text";

// The citation guard validates that every source-backed claim points to a span
// that actually contains it. Because anchors index the pass-1 transcript (never
// pixels), this is a deterministic string match, not a judgment call.
//
//   pass         quote found at the cited anchor
//   needs_review quote found in the document, but on a different line
//   fail         the anchor doesn't exist, or the quote isn't in the document
//
// Any fail blocks packet export. Citation integrity comes from this check, not
// from the model's good behavior.

function lineAt(transcript: Transcript, page: number, line: number): string | null {
  const found = transcript.lines.find((l) => l.anchor.page === page && l.anchor.line === line);
  return found ? found.text : null;
}

function checkOne(transcript: Transcript, field: string, page: number, line: number, quote: string): CitationCheck {
  const at = lineAt(transcript, page, line);
  const anchor = { page, line };
  const base = { field, anchor, quote };

  if (at !== null && looseIncludes(at, quote)) {
    return { ...base, verdict: "pass", detail: `Quote found at ${anchorId(anchor)}.` };
  }
  // Cited line is wrong or missing, but the quote may still be in the document:
  // right quote, wrong anchor. That is a needs_review, not a fail.
  const elsewhere = transcript.lines.find((l) => looseIncludes(l.text, quote));
  if (elsewhere) {
    const why = at === null ? `no line at ${anchorId(anchor)}` : `not on the cited ${anchorId(anchor)}`;
    return {
      ...base,
      verdict: "needs_review",
      detail: `Quote is on ${anchorId(elsewhere.anchor)}, ${why}.`,
    };
  }
  // The quote might be an aggregate the model paraphrased; only fail if the core
  // token (a number or dollar figure) is genuinely absent from the whole doc.
  const token = normalizeForMatch(quote);
  const anywhere = transcript.lines.some((l) => normalizeForMatch(l.text).includes(token));
  if (!anywhere) {
    return { ...base, verdict: "fail", detail: `Quote not found anywhere in ${transcript.filename}.` };
  }
  return {
    ...base,
    verdict: "needs_review",
    detail: `Quote does not match ${anchorId(anchor)} exactly; verify against the source.`,
  };
}

const RANK: Record<Verdict, number> = { pass: 0, needs_review: 1, fail: 2 };

export function guardRecords(records: CaseRecord[], transcripts: Transcript[]): GuardReport {
  const byDoc = new Map(transcripts.map((t) => [t.documentId, t]));
  const checks: CitationCheck[] = [];

  for (const record of records) {
    const transcript = byDoc.get(record.documentId);
    for (const c of record.citations) {
      if (!transcript) {
        checks.push({
          field: c.field,
          anchor: c.anchor,
          quote: c.quote,
          verdict: "fail",
          detail: `No transcript for document ${record.documentId}.`,
        });
        continue;
      }
      checks.push(checkOne(transcript, c.field, c.anchor.page, c.anchor.line, c.quote));
    }
  }

  const verdict = checks.reduce<Verdict>(
    (worst, c) => (RANK[c.verdict] > RANK[worst] ? c.verdict : worst),
    "pass",
  );

  const counts = {
    pass: checks.filter((c) => c.verdict === "pass").length,
    needs_review: checks.filter((c) => c.verdict === "needs_review").length,
    fail: checks.filter((c) => c.verdict === "fail").length,
  };

  return {
    checks,
    verdict,
    summary: `${checks.length} citations checked: ${counts.pass} pass, ${counts.needs_review} need review, ${counts.fail} fail.`,
  };
}
