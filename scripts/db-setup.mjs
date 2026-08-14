// One-time database setup for the case-workflow store.
//
// Applies src/lib/case/schema.sql to the Neon database in DATABASE_URL, then
// reconciles two constraints that changed after the initial schema shipped. It
// is safe to run against either a brand-new database or one already created
// from the original schema — every step is idempotent.
//
//   DATABASE_URL is read from the environment or from .env.local.
//   Run with: npm run db:setup

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// Minimal .env.local loader so this needs no extra dependency.
function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (!m || m[1] in process.env) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // No .env.local — rely on the ambient environment.
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set. Provision a Neon database and add it to .env.local\n" +
      "(see .env.example), then re-run `npm run db:setup`.",
  );
  process.exit(1);
}

const sql = neon(url);

// The base schema. Split on statement boundaries; every statement is guarded by
// `if not exists`, so re-running is a no-op on tables that already exist.
const schema = [
  readFileSync(resolve(root, "src/lib/case/schema.sql"), "utf8"),
  readFileSync(resolve(root, "src/lib/db/schema.sql"), "utf8"),
].join("\n\n");
const statements = schema
  .split("\n")
  .filter((l) => !l.trim().startsWith("--")) // drop full-line comments
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

// Constraint reconciliation for databases created from the original schema.
// On a fresh database the base schema already defines these, so both blocks are
// no-ops (the guards see the current shape and skip).
const migrations = [
  // mappings primary key widened from (record_id, field) to
  // (record_id, field, page, line) so a field cited from two spans keeps both.
  `do $$
   declare pk_cols int;
   begin
     select cardinality(conkey) into pk_cols
     from pg_constraint
     where conrelid = 'mappings'::regclass and contype = 'p';
     if pk_cols = 2 then
       alter table mappings drop constraint mappings_pkey;
       alter table mappings add primary key (record_id, field, page, line);
     end if;
   end $$;`,
  // review_questions gains a unique (case_id, fact) so re-running reconciliation
  // upserts one question per fact instead of stacking duplicates.
  `do $$
   begin
     if not exists (
       select 1 from pg_constraint
       where conrelid = 'review_questions'::regclass and contype = 'u'
         and conname = 'review_questions_case_id_fact_key'
     ) then
       alter table review_questions add constraint review_questions_case_id_fact_key unique (case_id, fact);
     end if;
   end $$;`,
];

async function main() {
  console.log(`Applying schema (${statements.length} statements)...`);
  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log("Reconciling constraints...");
  for (const stmt of migrations) {
    await sql.query(stmt);
  }
  console.log("Done. Database is ready.");
}

main().catch((err) => {
  console.error("\nSetup failed:", err.message);
  console.error(
    "If this is an ADD CONSTRAINT failure on review_questions, the table has\n" +
      "duplicate (case_id, fact) rows that must be removed before the unique key\n" +
      "can be added.",
  );
  process.exit(1);
});
