// Deterministic-core smoke test. No API key required. Exercises chunk,
// coverage, reconcile, and citation-guard against fixtures modeled on JJ's real
// Pep Boys documents (work order 2068633: invoice + POS receipt).
//
// Run with: node --experimental-strip-types scripts/test-case-core.mjs
// (Node 22+ strips the TS import extensions; if that flag is unavailable the
//  build/typecheck still covers these modules.)

import { chunk, operativeChunks } from "../src/lib/case/chunk.ts";
import { runCoverageGate, unconsumedMessage } from "../src/lib/case/coverage.ts";
import { reconcile } from "../src/lib/case/reconcile.ts";
import { guardRecords } from "../src/lib/case/citation-guard.ts";

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}`);
  }
}

// --- Fixtures -------------------------------------------------------------

function line(page, ln, text) {
  return { anchor: { page, line: ln }, text };
}

// Invoice transcript (work order 2068633, dated 2026-07-07).
const invoice = {
  documentId: "doc-invoice",
  filename: "2068633_report.pdf",
  pageCount: 2,
  lines: [
    line(1, 1, "Invoice - Customer Copy - Page 1"), // furniture
    line(1, 5, "Vin No.: JM1BM1T7XG1284334"),
    line(1, 6, "Mileage In / Out: 62786 / 62786"),
    line(1, 8, "Date : 2026-07-07"),
    line(1, 12, "PENNZOIL PLATINUM SYNTHETIC OIL CHANGE 39.04"),
    line(1, 18, "Total : 145.44"),
    line(1, 40, "NEED A TOW? CALL 1-800-PEP-BOYS"), // furniture
    line(2, 3, "Installed parts replaced free if they fail within 6 months or 6,000 miles"),
  ],
};

// POS receipt for the same visit, but dated 2026-07-15.
const posReceipt = {
  documentId: "doc-pos",
  filename: "644910502589720260715_RCT.pdf",
  pageCount: 1,
  lines: [
    line(1, 1, "PEP BOYS #6449"),
    line(1, 4, "07/15/2026 4:05:28 PM PST"),
    line(1, 20, "Total 145.44"),
    line(1, 22, "Order #: 2068633"),
  ],
};

const dogPhoto = {
  documentId: "doc-dog",
  filename: "IMG_4021.jpg",
  pageCount: 1,
  lines: [line(1, 1, "a photograph of a golden retriever in a park")],
};

// --- 1. Chunking keeps operative language, drops furniture ----------------

const invoiceChunks = chunk(invoice, ["vehicle", "line_items", "totals", "inspection", "warranty"]);
const chunkTexts = invoiceChunks.map((c) => c.text);
check("chunk drops the invoice header", !chunkTexts.some((t) => t.includes("Customer Copy")));
check("chunk drops the tow boilerplate", !chunkTexts.some((t) => t.includes("NEED A TOW")));
check("chunk keeps the VIN line", chunkTexts.some((t) => t.includes("JM1BM1T7XG1284334")));
check(
  "chunk tags the VIN as vehicle",
  invoiceChunks.find((c) => c.text.includes("Vin No"))?.tag === "vehicle",
);
check(
  "chunk tags the total as totals",
  invoiceChunks.find((c) => c.text.includes("Total : 145.44"))?.tag === "totals",
);
check(
  "chunk tags the warranty line as warranty",
  invoiceChunks.find((c) => c.text.includes("6,000 miles"))?.tag === "warranty",
);
check("operativeChunks drops the other bucket", operativeChunks(invoiceChunks).every((c) => c.tag !== "other"));

// --- 2. Coverage gate: dog photo is unconsumed ----------------------------

const goodRecords = [
  { id: "r1", type: "visit", documentId: "doc-invoice", payload: { total: 145.44, serviceDate: "2026-07-07" }, citations: [], reviewStatus: "ok", unresolvedQuestion: null },
  { id: "r2", type: "visit", documentId: "doc-pos", payload: { total: 145.44, serviceDate: "2026-07-15" }, citations: [], reviewStatus: "ok", unresolvedQuestion: null },
];

const coverageAllGood = runCoverageGate([invoice, posReceipt], goodRecords);
check("coverage is clear when every doc produced a record", coverageAllGood.clear === true);

const coverageWithDog = runCoverageGate([invoice, posReceipt, dogPhoto], goodRecords);
check("coverage is NOT clear with an unconsumed dog photo", coverageWithDog.clear === false);
check(
  "dog photo is marked unconsumed",
  coverageWithDog.documents.find((d) => d.documentId === "doc-dog")?.status === "unconsumed",
);
check(
  "unconsumed message names the dog photo",
  (unconsumedMessage(coverageWithDog) ?? "").includes("IMG_4021.jpg"),
);

// --- 3. Reconciliation: the two receipts disagree on the date -------------

const questions = reconcile(goodRecords, ["total", "serviceDate"]);
check("reconcile raises exactly one question", questions.length === 1);
check("the question is about serviceDate", questions[0]?.fact === "serviceDate");
check(
  "the question carries both source values",
  questions[0]?.sources["doc-invoice"] === "2026-07-07" &&
    questions[0]?.sources["doc-pos"] === "2026-07-15",
);
check("total does NOT raise a question (both are 145.44)", !questions.some((q) => q.fact === "total"));

// --- 4. Citation guard: pass / needs_review / fail ------------------------

const guarded = guardRecords(
  [
    {
      id: "r1",
      type: "visit",
      documentId: "doc-invoice",
      payload: { total: 145.44 },
      citations: [
        { field: "total", anchor: { page: 1, line: 18 }, quote: "Total : 145.44" }, // pass
        { field: "vin", anchor: { page: 1, line: 99 }, quote: "JM1BM1T7XG1284334" }, // wrong line -> needs_review
        { field: "phantom", anchor: { page: 1, line: 5 }, quote: "free car wash coupon" }, // absent -> fail
      ],
      reviewStatus: "ok",
      unresolvedQuestion: null,
    },
  ],
  [invoice],
);

check("guard passes the correctly-cited total", guarded.checks.find((c) => c.field === "total")?.verdict === "pass");
check(
  "guard flags a right-quote-wrong-line as needs_review",
  guarded.checks.find((c) => c.field === "vin")?.verdict === "needs_review",
);
check("guard fails a fabricated quote", guarded.checks.find((c) => c.field === "phantom")?.verdict === "fail");
check("overall verdict is fail (worst of the three)", guarded.verdict === "fail");

// --- Summary --------------------------------------------------------------

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
