-- Vehicle domain persistence.
--
-- Two properties matter more than anything else in this schema, and both exist
-- to serve the used car buyer rather than the current owner:
--
--   1. recorded_at is assigned by the database, never by the client. A record's
--      age is the strongest evidence it has. A history maintained continuously
--      since 2021 is credible; one created the week the car was listed is not.
--      A client supplied timestamp would let a seller manufacture that history.
--
--   2. Records are append only. Corrections are amendments with their own
--      timestamps, and deletions are soft. A seller can add to a history but
--      never quietly remove the transmission repair from it. Without this, none
--      of the trust modeling above it is worth anything.
--
-- Scoped by client_id, an anonymous per visitor cookie, so demo visitors never
-- share a garage. This is separate from src/lib/case, which is a general
-- document evidence engine that knows nothing about cars.

create table if not exists garages (
  id          text primary key,
  client_id   text not null unique,     -- anonymous per-visitor cookie value
  created_at  timestamptz not null default now()
);
create index if not exists garages_client_idx on garages (client_id);

create table if not exists vehicles (
  id              text primary key,
  garage_id       text not null references garages (id) on delete cascade,
  -- The VIN is the identity spine. It is the only key that survives a phone
  -- change, follows the car through a sale, and can be joined against recalls
  -- and factory coverage. Nullable only because a receipt does not always
  -- print one.
  vin             text,
  year            int,
  make            text not null,
  model           text not null,
  license_plate   text,
  nickname        text,
  current_mileage int,
  mileage_as_of   date,
  -- Cached NHTSA vPIC decode, so a VIN lookup is not repeated on every render.
  vin_decode      jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists vehicles_garage_idx on vehicles (garage_id);
create unique index if not exists vehicles_garage_vin_idx on vehicles (garage_id, vin) where vin is not null;

-- One row per service visit. The extracted record travels as jsonb: the domain
-- shape is still moving, and freezing it into columns now would cost more than
-- it buys. The columns that are promoted out are the ones the trust model and
-- the mileage curve query directly.
create table if not exists visits (
  id                  text primary key,
  vehicle_id          text not null references vehicles (id) on delete cascade,
  payload             jsonb not null,        -- ExtractedVisit
  -- Provenance. intake_method decides the trust tier; payment_matched is the
  -- independent second source that lifts a photograph to corroborated.
  intake_method       text not null,         -- shop_email | pdf | photo | owner_entry | seed
  payment_matched     boolean not null default false,
  has_source_document boolean not null default false,
  thumbnail           text,                  -- small dataURL, originals are never stored
  -- Promoted out of payload for the odometer curve, which is queried far more
  -- often than anything else and is the anti-fraud spine.
  occurred_on         date,
  mileage             int,
  recorded_at         timestamptz not null default now(),   -- server assigned. never trust the client.
  deleted_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists visits_vehicle_idx on visits (vehicle_id) where deleted_at is null;
create index if not exists visits_mileage_idx on visits (vehicle_id, occurred_on);

-- The append only history. Editing a visit writes the prior payload here first,
-- so the current row is always the latest version and the chain back to the
-- original is intact. This is what makes "the seller can add but never delete"
-- a property of the data rather than a promise in a README.
create table if not exists visit_amendments (
  id            bigserial primary key,
  visit_id      text not null references visits (id) on delete cascade,
  prior_payload jsonb not null,
  reason        text,
  created_at    timestamptz not null default now()
);
create index if not exists visit_amendments_visit_idx on visit_amendments (visit_id);

-- Odometer readings that did not come from a service visit: an owner entry, a
-- state inspection, or a connected car feed. Kept apart from visits so the
-- mileage curve can draw on sources that have no receipt behind them, which is
-- exactly what makes the curve hard to fabricate.
create table if not exists odometer_readings (
  id          bigserial primary key,
  vehicle_id  text not null references vehicles (id) on delete cascade,
  value       int not null,
  read_on     date not null,
  source      text not null,          -- owner | inspection | connected_car
  origin      text,
  recorded_at timestamptz not null default now()
);
create index if not exists odometer_vehicle_idx on odometer_readings (vehicle_id, read_on);
