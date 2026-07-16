import type { CaseRecord, CoverageReport, DocumentCoverage, Transcript } from "./types";

// The coverage gate. Every ingested document must produce at least one
// normalized record or be explicitly marked reference-only. If any document is
// unaccounted for, the workflow stops before drafting.
//
// This is also the classifier, retired: a document that yields no records is
// unconsumed, whether it is a grocery receipt, a photo of a dog, or a page too
// blurry to read. There is no taxonomy of rejection kinds to maintain.

export function runCoverageGate(
  transcripts: Transcript[],
  records: CaseRecord[],
  referenceOnlyIds: Set<string> = new Set(),
): CoverageReport {
  const producedBy = new Set(records.map((r) => r.documentId));

  const documents: DocumentCoverage[] = transcripts.map((t) => {
    let status: DocumentCoverage["status"];
    if (producedBy.has(t.documentId)) status = "consumed";
    else if (referenceOnlyIds.has(t.documentId)) status = "reference_only";
    else status = "unconsumed";
    return { documentId: t.documentId, filename: t.filename, status };
  });

  return {
    documents,
    clear: documents.every((d) => d.status !== "unconsumed"),
  };
}

/** User-facing summary of what is unaccounted for, named individually so the
 *  user knows which upload to retake or drop. */
export function unconsumedMessage(report: CoverageReport): string | null {
  const unconsumed = report.documents.filter((d) => d.status === "unconsumed");
  if (unconsumed.length === 0) return null;
  if (unconsumed.length === 1) {
    return `${unconsumed[0].filename} didn't produce any records. It may not be a service receipt, or the photo may be too unclear to read.`;
  }
  const names = unconsumed.map((d) => d.filename).join(", ");
  return `${unconsumed.length} uploads didn't produce any records: ${names}. They may not be service receipts, or the photos may be too unclear to read.`;
}
