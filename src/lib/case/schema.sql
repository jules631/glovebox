-- Case-workflow persistence. Source-backed facts (records + mappings) are kept
-- strictly apart from inferred classifications, so a citation always points at
-- evidence, never at a judgment. Everything is scoped by case_id, which is in
-- turn scoped to an anonymous client so demo visitors never share a ledger.

create table if not exists cases (
  id            text primary key,
  client_id     text not null,          -- anonymous per-visitor cookie value
  noun          text not null,          -- e.g. 'vehicle'
  title         text,
  created_at    timestamptz not null default now()
);
create index if not exists cases_client_idx on cases (client_id);

create table if not exists documents (
  id            text primary key,
  case_id       text not null references cases (id) on delete cascade,
  filename      text not null,
  sha256        text,
  page_count    int  not null default 1,
  status        text not null default 'unconsumed',   -- consumed | reference_only | unconsumed
  created_at    timestamptz not null default now()
);
create index if not exists documents_case_idx on documents (case_id);

-- The pass-1 transcript: the one artifact pass 2 and the guard are allowed to read.
create table if not exists transcript_lines (
  document_id   text not null references documents (id) on delete cascade,
  page          int  not null,
  line          int  not null,
  text          text not null,
  primary key (document_id, page, line)
);

-- Operative language only; furniture and headings are dropped before insert.
create table if not exists chunks (
  id            bigserial primary key,
  document_id   text not null references documents (id) on delete cascade,
  page          int  not null,
  line          int  not null,
  tag           text not null,
  text          text not null
);
create index if not exists chunks_doc_idx on chunks (document_id);

-- SOURCE-BACKED facts. payload is the normalized record; review_status carries a
-- concrete unresolved_question when a sanity check fails.
create table if not exists records (
  id                 text primary key,
  case_id            text not null references cases (id) on delete cascade,
  document_id        text not null references documents (id) on delete cascade,
  type               text not null,
  payload            jsonb not null,
  governing_source   text,
  review_status      text not null default 'ok',        -- ok | needs_review
  unresolved_question text,
  created_at         timestamptz not null default now()
);
create index if not exists records_case_idx on records (case_id);

-- The chain of custody: every source-backed field -> the span it came from.
create table if not exists mappings (
  record_id     text not null references records (id) on delete cascade,
  field         text not null,
  page          int  not null,
  line          int  not null,
  quote         text not null,
  primary key (record_id, field)
);

-- INFERRED classifications, kept apart from source-backed facts. Never cited.
create table if not exists classifications (
  id            bigserial primary key,
  record_id     text not null references records (id) on delete cascade,
  field         text not null,
  value         text not null,
  rationale     text
);

create table if not exists review_questions (
  id            text primary key,
  case_id       text not null references cases (id) on delete cascade,
  fact          text not null,
  question      text not null,
  sources       jsonb not null,
  governing_source text,
  status        text not null default 'open',           -- open | resolved
  created_at    timestamptz not null default now()
);
create index if not exists review_questions_case_idx on review_questions (case_id);

-- Drafted packets. guard_verdict records the citation guard's ruling at export;
-- a 'fail' packet is never written (export is refused upstream).
create table if not exists outputs (
  id            text primary key,
  case_id       text not null references cases (id) on delete cascade,
  kind          text not null,
  body          text not null,
  guard_verdict text not null,
  created_at    timestamptz not null default now()
);
create index if not exists outputs_case_idx on outputs (case_id);
