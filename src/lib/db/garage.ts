// Server side garage store. The only module that talks to Postgres about cars.
//
// Two invariants this file exists to enforce, both of which the client is not
// allowed to influence:
//   - recorded_at is assigned by the database
//   - an edit writes the prior payload to visit_amendments before overwriting
//
// Everything the trust model claims rests on those two lines being true here.

// Server side only: imported exclusively from route handlers under src/app/api.
import { neon } from "@neondatabase/serverless";
import type { ExtractedReceipt, IntakeMethod, Provenance, ServiceVisit, Vehicle } from "../types";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Run `npm run db:setup` after provisioning Neon.");
  // Neon's HTTP driver issues its queries through global fetch, which the
  // framework patches for its own caching. Left alone, every query gets treated
  // as a cacheable data fetch, which is both wrong (these are writes and
  // per-visitor reads) and pathologically slow in development. Opting out puts
  // query latency back where it belongs, at the database round trip.
  return neon(url, { fetchOptions: { cache: "no-store" } });
}

/** Rows come back as loosely typed records; narrow at the boundary. */
type Row = Record<string, unknown>;

/**
 * Postgres date columns can surface as JS Date objects rather than strings,
 * and String(someDate) is "Wed Jul 15 2026...", whose first ten characters are
 * not a date. That garbled value fed Date.parse downstream and turned every
 * mileage projection into NaN, which the odometer then rendered as 000NaN.
 */
function isoDate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * Get or create the garage for this visitor in one round trip.
 *
 * The read-then-insert-then-read version was three round trips, and every write
 * path called it, so saving six records meant eighteen trips before any real
 * work happened. An upsert that returns the row on both branches collapses that
 * to one. On a serverless Postgres connection the round trip is the entire cost.
 */
async function garageId(clientId: string): Promise<string> {
  const sql = db();
  const id = `gar_${crypto.randomUUID()}`;
  const rows = (await sql`
    insert into garages (id, client_id) values (${id}, ${clientId})
    on conflict (client_id) do update set client_id = excluded.client_id
    returning id
  `) as Row[];
  return rows[0].id as string;
}

function toVehicle(row: Row): Vehicle {
  return {
    id: row.id as string,
    vin: (row.vin as string) ?? null,
    year: (row.year as number) ?? null,
    make: row.make as string,
    model: row.model as string,
    licensePlate: (row.license_plate as string) ?? null,
    nickname: (row.nickname as string) ?? null,
    currentMileage: (row.current_mileage as number) ?? null,
    mileageAsOf: isoDate(row.mileage_as_of),
  };
}

function toVisit(row: Row): ServiceVisit {
  const payload = row.payload as ServiceVisit;
  const provenance: Provenance = {
    method: row.intake_method as IntakeMethod,
    recordedAt: new Date(row.recorded_at as string).toISOString(),
    amendedAt: row.amended_at ? new Date(row.amended_at as string).toISOString() : null,
    amendmentCount: Number(row.amendment_count ?? 0),
    paymentMatched: Boolean(row.payment_matched),
    hasSourceDocument: Boolean(row.has_source_document),
  };
  return {
    ...payload,
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    receiptThumbnail: (row.thumbnail as string) ?? null,
    provenance,
  };
}

export interface Garage {
  vehicles: Vehicle[];
  visits: ServiceVisit[];
}

export async function loadGarage(clientId: string): Promise<Garage> {
  const sql = db();
  const gid = await garageId(clientId);

  const vehicleRows = (await sql`
    select * from vehicles where garage_id = ${gid} order by created_at asc
  `) as Row[];

  if (!vehicleRows.length) return { vehicles: [], visits: [] };

  // amendment_count and amended_at are derived rather than stored, so they can
  // never drift out of step with the amendment table they describe.
  const visitRows = (await sql`
    select v.*,
           (select count(*) from visit_amendments a where a.visit_id = v.id) as amendment_count,
           (select max(a.created_at) from visit_amendments a where a.visit_id = v.id) as amended_at
    from visits v
    join vehicles ve on ve.id = v.vehicle_id
    where ve.garage_id = ${gid} and v.deleted_at is null
    order by v.occurred_on desc nulls last, v.recorded_at desc
  `) as Row[];

  return { vehicles: vehicleRows.map(toVehicle), visits: visitRows.map(toVisit) };
}

/** Match an extracted vehicle to one already in the garage, by VIN first. */
function matchVehicle(vehicles: Vehicle[], extracted: ExtractedReceipt["vehicle"]): Vehicle | undefined {
  if (extracted.vin) {
    const byVin = vehicles.find((v) => v.vin && v.vin.toUpperCase() === extracted.vin!.toUpperCase());
    if (byVin) return byVin;
  }
  return vehicles.find(
    (v) =>
      v.make.toLowerCase() === extracted.make.toLowerCase() &&
      v.model.toLowerCase() === extracted.model.toLowerCase() &&
      (v.year == null || extracted.year == null || v.year === extracted.year),
  );
}

export interface SaveOptions {
  vehicleId?: string;
  receiptThumbnail?: string | null;
  intakeMethod: IntakeMethod;
  hasSourceDocument?: boolean;
}

/**
 * The client-facing save. A cookie-authenticated visitor can photograph a
 * receipt or log work by hand, but the trust tier is the server's to decide,
 * never the client's: this path can only ever mint `photo` or `owner_entry`,
 * and it holds no source document the server can vouch for. The shop-originated
 * tiers exist only on the inbound-webhook path, which observes a real shop
 * email. Clamping here means no current or future cookie route can forge trust,
 * even if it passes `intakeMethod: "shop_email"` in the body.
 */
export async function saveReceipt(
  clientId: string,
  receipt: ExtractedReceipt,
  options: SaveOptions,
): Promise<{ vehicleId: string; visitId: string }> {
  const gid = await garageId(clientId);
  const intakeMethod: IntakeMethod = options.intakeMethod === "owner_entry" ? "owner_entry" : "photo";
  return saveReceiptForGarage(gid, receipt, {
    vehicleId: options.vehicleId,
    receiptThumbnail: options.receiptThumbnail,
    intakeMethod,
    hasSourceDocument: false,
  });
}

/**
 * Write a demo record. Trusted server path (the seed route only), tiered as
 * `seed` so the trust model reports it as a fixture and never counts it as
 * evidence, which is what the demo garage is supposed to be.
 */
export async function saveDemoReceipt(
  clientId: string,
  receipt: ExtractedReceipt,
): Promise<{ vehicleId: string; visitId: string }> {
  const gid = await garageId(clientId);
  return saveReceiptForGarage(gid, receipt, { intakeMethod: "seed", hasSourceDocument: false });
}

/** The save path itself, shared by the cookie routes and the inbound webhook. */
export async function saveReceiptForGarage(
  gid: string,
  receipt: ExtractedReceipt,
  options: SaveOptions,
): Promise<{ vehicleId: string; visitId: string }> {
  const sql = db();
  // Only the vehicles are needed to match. Loading the full visit history here
  // made every save scale with the size of the record it was appending to.
  const vehicles = ((await sql`
    select * from vehicles where garage_id = ${gid} order by created_at asc
  `) as Row[]).map(toVehicle);

  let vehicleId = options.vehicleId;
  if (vehicleId) {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) {
      // The client supplied a vehicleId that is not in this garage. Never insert
      // a visit against a car another garage owns: an unknown id is a rejection,
      // not a silent cross-tenant write.
      throw new Error("vehicle not found in this garage");
    }
    // Fill gaps from the receipt without clobbering what the owner has set.
    // current_mileage is read and advanced inside SQL rather than echoed back
    // from the value read at the top of this request, so a concurrent odometer
    // update cannot be reverted, and the number only ever moves forward.
    const newMileage = receipt.visit.mileage;
    const newAsOf = receipt.visit.dateOut ?? receipt.visit.dateIn;
    await sql`
      update vehicles set
        vin = coalesce(vin, ${receipt.vehicle.vin}),
        license_plate = coalesce(license_plate, ${receipt.vehicle.licensePlate}),
        year = coalesce(year, ${receipt.vehicle.year}),
        current_mileage = case
          when ${newMileage}::int is not null and ${newMileage}::int > coalesce(current_mileage, 0)
          then ${newMileage}::int else current_mileage end,
        mileage_as_of = case
          when ${newMileage}::int is not null and ${newMileage}::int > coalesce(current_mileage, 0)
          then ${newAsOf}::date else mileage_as_of end
      where id = ${vehicleId}
    `;
  } else {
    const matched = matchVehicle(vehicles, receipt.vehicle);
    if (matched) {
      vehicleId = matched.id;
    } else {
      vehicleId = `veh_${crypto.randomUUID()}`;
      await sql`
        insert into vehicles (id, garage_id, vin, year, make, model, license_plate, current_mileage, mileage_as_of)
        values (${vehicleId}, ${gid}, ${receipt.vehicle.vin}, ${receipt.vehicle.year}, ${receipt.vehicle.make},
                ${receipt.vehicle.model}, ${receipt.vehicle.licensePlate}, ${receipt.visit.mileage},
                ${receipt.visit.dateOut ?? receipt.visit.dateIn})
      `;
    }
  }

  const visitId = `vis_${crypto.randomUUID()}`;
  await sql`
    insert into visits (id, vehicle_id, payload, intake_method, has_source_document, thumbnail, occurred_on, mileage)
    values (${visitId}, ${vehicleId}, ${JSON.stringify(receipt.visit)}, ${options.intakeMethod},
            ${options.hasSourceDocument ?? false}, ${options.receiptThumbnail ?? null},
            ${receipt.visit.dateOut ?? receipt.visit.dateIn}, ${receipt.visit.mileage})
  `;

  return { vehicleId: vehicleId!, visitId };
}

/**
 * Amend a visit. The prior payload is written to the amendment log before the
 * row changes, so the chain back to what was originally recorded stays intact
 * and a correction can never masquerade as the original.
 */
export async function amendVisit(
  clientId: string,
  visitId: string,
  payload: ServiceVisit,
  reason: string | null,
): Promise<void> {
  const sql = db();
  const gid = await garageId(clientId);
  const rows = (await sql`
    select v.payload from visits v join vehicles ve on ve.id = v.vehicle_id
    where v.id = ${visitId} and ve.garage_id = ${gid}
  `) as Row[];
  if (!rows.length) throw new Error("Visit not found in this garage.");

  await sql`
    insert into visit_amendments (visit_id, prior_payload, reason)
    values (${visitId}, ${JSON.stringify(rows[0].payload)}, ${reason})
  `;
  await sql`
    update visits set payload = ${JSON.stringify(payload)},
                      occurred_on = ${payload.dateOut ?? payload.dateIn},
                      mileage = ${payload.mileage}
    where id = ${visitId}
  `;
}

/** Soft delete. A removed record still leaves a trace that it existed. */
export async function removeVisit(clientId: string, visitId: string): Promise<void> {
  const sql = db();
  const gid = await garageId(clientId);
  await sql`
    update visits set deleted_at = now()
    where id = ${visitId}
      and vehicle_id in (select id from vehicles where garage_id = ${gid})
  `;
}

export async function setMileage(clientId: string, vehicleId: string, mileage: number): Promise<void> {
  const sql = db();
  const gid = await garageId(clientId);
  const today = new Date().toISOString().slice(0, 10);
  await sql`
    update vehicles set current_mileage = ${mileage}, mileage_as_of = ${today}
    where id = ${vehicleId} and garage_id = ${gid}
  `;
  // Kept as its own reading too, so the mileage curve gains an independent
  // point rather than just moving a single mutable number.
  await sql`
    insert into odometer_readings (vehicle_id, value, read_on, source, origin)
    values (${vehicleId}, ${mileage}, ${today}, 'owner', 'Owner entered')
  `;
}

export async function setNickname(clientId: string, vehicleId: string, nickname: string | null): Promise<void> {
  const sql = db();
  const gid = await garageId(clientId);
  await sql`update vehicles set nickname = ${nickname} where id = ${vehicleId} and garage_id = ${gid}`;
}

export async function saveVinDecode(clientId: string, vehicleId: string, decode: unknown): Promise<void> {
  const sql = db();
  const gid = await garageId(clientId);
  await sql`
    update vehicles set vin_decode = ${JSON.stringify(decode)}
    where id = ${vehicleId} and garage_id = ${gid}
  `;
}

// The Glovebox address

const ALIAS_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i

function newAliasToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALIAS_ALPHABET[b % ALIAS_ALPHABET.length]).join("");
}

/** The garage's permanent intake token, minted on first ask. */
export async function getOrCreateAliasToken(clientId: string): Promise<string> {
  const sql = db();
  const gid = await garageId(clientId);
  const rows = (await sql`select alias_token from garages where id = ${gid}`) as Row[];
  const existing = rows[0]?.alias_token as string | null;
  if (existing) return existing;

  const token = newAliasToken();
  // A collision across 31^8 tokens is vanishingly rare; the partial unique
  // index turns the rare one into a retried request rather than a corrupt state.
  await sql`update garages set alias_token = ${token} where id = ${gid} and alias_token is null`;
  const settled = (await sql`select alias_token from garages where id = ${gid}`) as Row[];
  return settled[0].alias_token as string;
}

export async function garageIdByAliasToken(token: string): Promise<string | null> {
  const sql = db();
  const rows = (await sql`select id from garages where alias_token = ${token}`) as Row[];
  return rows.length ? (rows[0].id as string) : null;
}

// Inbound mail log: recorded before processing so a failed extraction is a
// visible state, never lost mail.

/**
 * Record an inbound message before processing. Returns the new row id, or null
 * when this MessageID has already been seen: Postmark delivers at least once, so
 * a retry or replay must not become a second extraction and a second visit. The
 * unique index on message_id makes the dedupe atomic under concurrent delivery.
 */
export async function recordInbound(
  gid: string,
  fromEmail: string | null,
  subject: string | null,
  messageId: string | null,
): Promise<string | null> {
  const sql = db();
  const id = `inb_${crypto.randomUUID()}`;
  const rows = (await sql`
    insert into inbound_messages (id, garage_id, from_email, subject, message_id)
    values (${id}, ${gid}, ${fromEmail}, ${subject}, ${messageId})
    on conflict (message_id) where message_id is not null do nothing
    returning id
  `) as Row[];
  return rows.length ? (rows[0].id as string) : null;
}

export async function resolveInbound(id: string, visitId: string): Promise<void> {
  const sql = db();
  await sql`update inbound_messages set status = 'processed', visit_id = ${visitId} where id = ${id}`;
}

export async function failInbound(id: string, error: string): Promise<void> {
  const sql = db();
  await sql`update inbound_messages set status = 'failed', error = ${error.slice(0, 500)} where id = ${id}`;
}

export interface ExtractionCaps {
  perClientDaily: number;
  globalDaily: number;
}

/**
 * Durable rate limit for the extraction endpoint, the one expensive action a
 * mostly-unauthenticated client can trigger. Counts the last 24h per client and
 * across all clients; if either cap is already met, refuses. Otherwise records
 * one unit of usage and allows the call. Unlike an in-memory counter this
 * survives serverless cold starts and aggregates across the whole fleet, so the
 * daily spend has a real ceiling. The count-then-insert is not perfectly atomic,
 * but the caps are budget guards, not security boundaries, and a few concurrent
 * requests slipping past a soft limit is immaterial to cost.
 */
export async function reserveExtraction(
  clientId: string,
  caps: ExtractionCaps,
): Promise<{ ok: true } | { ok: false; reason: "client" | "global" }> {
  const sql = db();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const clientRows = (await sql`
    select count(*)::int as n from extraction_usage where client_id = ${clientId} and created_at >= ${since}
  `) as Row[];
  if ((clientRows[0]?.n as number) >= caps.perClientDaily) return { ok: false, reason: "client" };

  const globalRows = (await sql`
    select count(*)::int as n from extraction_usage where created_at >= ${since}
  `) as Row[];
  if ((globalRows[0]?.n as number) >= caps.globalDaily) return { ok: false, reason: "global" };

  await sql`insert into extraction_usage (client_id) values (${clientId})`;
  return { ok: true };
}
