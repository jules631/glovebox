import { z } from "zod";

// A document-grounded case workflow. These types are deliberately domain-agnostic:
// nothing here knows about cars, receipts, or warranties. A consumer supplies a
// CaseProfile; the primitives own the mechanics. The one invariant the whole
// chain rests on is the anchor scheme, emitted once at ingest and carried
// unchanged to the final packet.

/** A source coordinate. Renders as `p1:L23`. One scheme, end to end. */
export interface Anchor {
  page: number;
  line: number;
}

export function anchorId(a: Anchor): string {
  return `p${a.page}:L${a.line}`;
}

export function parseAnchor(id: string): Anchor | null {
  const m = /^p(\d+):L(\d+)$/.exec(id.trim());
  if (!m) return null;
  return { page: Number(m[1]), line: Number(m[2]) };
}

/** One page of an ingested document: the raw file seen once, transcribed to text. */
export interface Transcript {
  documentId: string;
  filename: string;
  pageCount: number;
  /** 1-indexed line -> text, per page. The only thing pass 2 is allowed to read. */
  lines: TranscriptLine[];
}

export interface TranscriptLine {
  anchor: Anchor;
  text: string;
}

/** A tagged span of operative language, carrying its anchor forward. */
export interface Chunk {
  anchor: Anchor;
  tag: string;
  text: string;
}

/** A source-backed fact and the exact span it was read from. Chain of custody. */
export interface Citation {
  field: string;
  anchor: Anchor;
  quote: string;
}

/** A normalized record: source-backed payload + its citations, kept apart from
 *  inferred classifications (which are never cited). */
export interface CaseRecord {
  id: string;
  type: string;
  documentId: string;
  payload: unknown;
  citations: Citation[];
  reviewStatus: "ok" | "needs_review";
  unresolvedQuestion: string | null;
}

/** Per-document verdict of the coverage gate. */
export interface DocumentCoverage {
  documentId: string;
  filename: string;
  status: "consumed" | "reference_only" | "unconsumed";
}

export interface CoverageReport {
  documents: DocumentCoverage[];
  /** True when every document is consumed or explicitly reference-only. */
  clear: boolean;
}

/** A disagreement between sources about a tracked fact, surfaced for a human. */
export interface ReviewQuestion {
  fact: string;
  question: string;
  /** documentId -> the value that document asserts. */
  sources: Record<string, string>;
  governingSource: string | null;
}

export type Verdict = "pass" | "needs_review" | "fail";

export interface CitationCheck {
  field: string;
  anchor: Anchor;
  quote: string;
  verdict: Verdict;
  detail: string;
}

export interface GuardReport {
  checks: CitationCheck[];
  verdict: Verdict; // worst of the checks; fail blocks export
  summary: string;
}

/** Context a sanity check may consult (e.g. prior records for monotonicity). */
export interface LedgerContext {
  priorRecords: CaseRecord[];
}

export type SanityCheck = (payload: unknown, ctx: LedgerContext) => string | null;

/**
 * The one domain-specific input. A consumer describes its document and facts;
 * the primitives do the rest. Everything car-aware in Glovebox lives in the
 * profile, never in the primitives that consume this type.
 */
export interface CaseProfile<T extends z.ZodTypeAny> {
  /** Plural noun for the case, e.g. "vehicle". */
  caseNoun: string;
  /** What a consumable document is, in the model's words. */
  expected: string;
  /** Evidence that qualifies a document as the expected kind. */
  evidence: string[];
  /** Structure tags the chunker should assign. */
  structureTags: string[];
  /** Schema for one source-backed record. */
  record: T;
  /** Facts reconciled across sources when they co-occur. */
  trackedFacts: string[];
  /** Sanity checks; a returned string becomes the unresolved question. */
  sanityChecks: SanityCheck[];
  /** Extraction rules appended to the normalize prompt. */
  rules: string;
}
