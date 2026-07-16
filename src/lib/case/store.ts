import { neon } from "@neondatabase/serverless";
import type {
  CaseRecord,
  Citation,
  CoverageReport,
  GuardReport,
  ReviewQuestion,
  Transcript,
} from "./types";

// Neon-backed case store. Domain-agnostic: it persists documents, transcripts,
// chunks, source-backed records, their citations, inferred classifications,
// review questions, and drafted packets. It knows nothing about cars.
//
// Every write is scoped to a case, and every case to an anonymous client id, so
// two demo visitors never touch the same ledger.

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Provision Neon and add it to .env.local.");
  return neon(url);
}

export async function ensureCase(id: string, clientId: string, noun: string, title?: string): Promise<void> {
  const sql = db();
  await sql`
    insert into cases (id, client_id, noun, title)
    values (${id}, ${clientId}, ${noun}, ${title ?? null})
    on conflict (id) do nothing
  `;
}

export async function saveTranscript(caseId: string, t: Transcript, status: string): Promise<void> {
  const sql = db();
  await sql`
    insert into documents (id, case_id, filename, page_count, status)
    values (${t.documentId}, ${caseId}, ${t.filename}, ${t.pageCount}, ${status})
    on conflict (id) do update set status = excluded.status
  `;
  for (const l of t.lines) {
    await sql`
      insert into transcript_lines (document_id, page, line, text)
      values (${t.documentId}, ${l.anchor.page}, ${l.anchor.line}, ${l.text})
      on conflict (document_id, page, line) do update set text = excluded.text
    `;
  }
}

export async function setDocumentStatus(documentId: string, status: string): Promise<void> {
  const sql = db();
  await sql`update documents set status = ${status} where id = ${documentId}`;
}

export async function saveRecord(caseId: string, record: CaseRecord): Promise<void> {
  const sql = db();
  await sql`
    insert into records (id, case_id, document_id, type, payload, governing_source, review_status, unresolved_question)
    values (${record.id}, ${caseId}, ${record.documentId}, ${record.type},
            ${JSON.stringify(record.payload)}, ${null}, ${record.reviewStatus}, ${record.unresolvedQuestion})
    on conflict (id) do update set
      payload = excluded.payload,
      review_status = excluded.review_status,
      unresolved_question = excluded.unresolved_question
  `;
  for (const c of record.citations) {
    await sql`
      insert into mappings (record_id, field, page, line, quote)
      values (${record.id}, ${c.field}, ${c.anchor.page}, ${c.anchor.line}, ${c.quote})
      on conflict (record_id, field) do update set
        page = excluded.page, line = excluded.line, quote = excluded.quote
    `;
  }
}

export async function saveClassifications(
  recordId: string,
  items: { field: string; value: string; rationale?: string }[],
): Promise<void> {
  const sql = db();
  for (const it of items) {
    await sql`
      insert into classifications (record_id, field, value, rationale)
      values (${recordId}, ${it.field}, ${it.value}, ${it.rationale ?? null})
    `;
  }
}

export async function saveReviewQuestions(caseId: string, questions: ReviewQuestion[]): Promise<void> {
  const sql = db();
  for (const q of questions) {
    await sql`
      insert into review_questions (id, case_id, fact, question, sources, governing_source)
      values (${crypto.randomUUID()}, ${caseId}, ${q.fact}, ${q.question},
              ${JSON.stringify(q.sources)}, ${q.governingSource})
    `;
  }
}

interface RecordRow {
  id: string;
  document_id: string;
  type: string;
  payload: unknown;
  review_status: "ok" | "needs_review";
  unresolved_question: string | null;
}
interface MappingRow {
  record_id: string;
  field: string;
  page: number;
  line: number;
  quote: string;
}

export async function getRecords(caseId: string): Promise<CaseRecord[]> {
  const sql = db();
  const rows = (await sql`
    select id, document_id, type, payload, review_status, unresolved_question
    from records where case_id = ${caseId} order by created_at
  `) as RecordRow[];
  const maps = (await sql`
    select m.record_id, m.field, m.page, m.line, m.quote
    from mappings m join records r on r.id = m.record_id
    where r.case_id = ${caseId}
  `) as MappingRow[];

  const byRecord = new Map<string, Citation[]>();
  for (const m of maps) {
    const list = byRecord.get(m.record_id) ?? [];
    list.push({ field: m.field, anchor: { page: m.page, line: m.line }, quote: m.quote });
    byRecord.set(m.record_id, list);
  }

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    documentId: r.document_id,
    payload: r.payload,
    citations: byRecord.get(r.id) ?? [],
    reviewStatus: r.review_status,
    unresolvedQuestion: r.unresolved_question,
  }));
}

export async function getTranscripts(caseId: string): Promise<Transcript[]> {
  const sql = db();
  const docs = (await sql`
    select id, filename, page_count from documents where case_id = ${caseId}
  `) as { id: string; filename: string; page_count: number }[];
  const lines = (await sql`
    select tl.document_id, tl.page, tl.line, tl.text
    from transcript_lines tl join documents d on d.id = tl.document_id
    where d.case_id = ${caseId} order by tl.page, tl.line
  `) as { document_id: string; page: number; line: number; text: string }[];

  return docs.map((d) => ({
    documentId: d.id,
    filename: d.filename,
    pageCount: d.page_count,
    lines: lines
      .filter((l) => l.document_id === d.id)
      .map((l) => ({ anchor: { page: l.page, line: l.line }, text: l.text })),
  }));
}

export async function getCoverage(caseId: string): Promise<CoverageReport> {
  const sql = db();
  const docs = (await sql`
    select id, filename, status from documents where case_id = ${caseId}
  `) as { id: string; filename: string; status: "consumed" | "reference_only" | "unconsumed" }[];
  return {
    documents: docs.map((d) => ({ documentId: d.id, filename: d.filename, status: d.status })),
    clear: docs.every((d) => d.status !== "unconsumed"),
  };
}

export async function saveOutput(
  caseId: string,
  kind: string,
  body: string,
  guard: GuardReport,
): Promise<string> {
  const sql = db();
  const id = crypto.randomUUID();
  await sql`
    insert into outputs (id, case_id, kind, body, guard_verdict)
    values (${id}, ${caseId}, ${kind}, ${body}, ${guard.verdict})
  `;
  return id;
}
