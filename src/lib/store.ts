// Client side garage access.
//
// This used to be the only module that touched localStorage, and that was the
// quiet contradiction at the center of the product: the pitch was an owner
// controlled record that outlives any single shop, while the implementation
// was one browser's local storage, erased by clearing site data and invisible
// on any other device. The competitive scan's own complaint about CARFAX,
// receipts stranded on one device that never sync, described this file exactly.
//
// It is now a thin async client over the API. Records live in Postgres with
// server assigned timestamps and an append only amendment log, because record
// age is the one thing a used car buyer can actually lean on and a seller must
// not be able to fabricate.

import type { ExtractedReceipt, IntakeMethod, ServiceVisit, Vehicle } from "./types";

export interface Garage {
  vehicles: Vehicle[];
  visits: ServiceVisit[];
}

const EMPTY: Garage = { vehicles: [], visits: [] };

// One in-flight fetch is shared across every caller in a render pass, so a page
// asking for a vehicle and its visits does not make two round trips.
let cache: Promise<Garage> | null = null;

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Something went wrong.");
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export function invalidateGarage(): void {
  cache = null;
}

export function getGarage(): Promise<Garage> {
  if (!cache) {
    const self: Promise<Garage> = request<Garage>("/api/garage").catch((error) => {
      // A failed load must not poison every later read. Guard on identity so a
      // late rejection only clears its own entry, never a newer in-flight one
      // started after an invalidate.
      if (cache === self) cache = null;
      throw error;
    });
    cache = self;
  }
  return cache;
}

export async function getVehicles(): Promise<Vehicle[]> {
  return (await getGarage()).vehicles;
}

export async function getVehicle(id: string): Promise<Vehicle | undefined> {
  return (await getGarage()).vehicles.find((v) => v.id === id);
}

function byDateDesc(a: ServiceVisit, b: ServiceVisit): number {
  return (b.dateIn ?? "").localeCompare(a.dateIn ?? "");
}

export async function getVisits(vehicleId: string): Promise<ServiceVisit[]> {
  return (await getGarage()).visits.filter((v) => v.vehicleId === vehicleId).sort(byDateDesc);
}

export async function getVisit(visitId: string): Promise<ServiceVisit | undefined> {
  return (await getGarage()).visits.find((v) => v.id === visitId);
}

export async function setVehicleMileage(vehicleId: string, mileage: number): Promise<void> {
  await request<void>(`/api/vehicles/${vehicleId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mileage }),
  });
  invalidateGarage();
}

export async function setVehicleNickname(vehicleId: string, nickname: string | null): Promise<void> {
  await request<void>(`/api/vehicles/${vehicleId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  invalidateGarage();
}

/** Match an extracted vehicle to one already in the garage, by VIN first. */
export async function matchVehicle(extracted: ExtractedReceipt["vehicle"]): Promise<Vehicle | undefined> {
  const vehicles = await getVehicles();
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

export interface SaveResult {
  vehicleId: string;
  visitId: string;
}

export async function saveExtractedReceipt(
  receipt: ExtractedReceipt,
  options: {
    vehicleId?: string;
    receiptThumbnail?: string | null;
    intakeMethod: IntakeMethod;
    hasSourceDocument?: boolean;
    idempotencyKey?: string;
  },
): Promise<SaveResult> {
  const result = await request<SaveResult>("/api/visits", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ receipt, ...options }),
  });
  invalidateGarage();
  return result;
}

export async function deleteVisit(visitId: string): Promise<void> {
  await request<void>(`/api/visits/${visitId}`, { method: "DELETE" });
  invalidateGarage();
}

/** Load the demo garage on purpose. Never automatic; see the seed route. */
export async function loadDemoGarage(): Promise<Garage> {
  const garage = await request<Garage>("/api/garage/seed", { method: "POST" });
  invalidateGarage();
  return garage;
}

export { EMPTY as EMPTY_GARAGE };
