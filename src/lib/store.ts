import type { ExtractedReceipt, ServiceVisit, Vehicle } from "./types";
import { seedVehicles, seedVisits } from "./seed";

// The only module that touches localStorage. Swapping to a hosted DB later
// means reimplementing these functions, nothing else.

const KEY = "glovebox.v1";

interface DB {
  vehicles: Vehicle[];
  visits: ServiceVisit[];
}

function load(): DB {
  if (typeof window === "undefined") return { vehicles: [], visits: [] };
  const raw = window.localStorage.getItem(KEY);
  if (!raw) {
    const db: DB = { vehicles: seedVehicles, visits: seedVisits };
    window.localStorage.setItem(KEY, JSON.stringify(db));
    return db;
  }
  try {
    return JSON.parse(raw) as DB;
  } catch {
    return { vehicles: [], visits: [] };
  }
}

function save(db: DB) {
  window.localStorage.setItem(KEY, JSON.stringify(db));
}

function byDateDesc(a: ServiceVisit, b: ServiceVisit): number {
  return (b.dateIn ?? "").localeCompare(a.dateIn ?? "");
}

export function getVehicles(): Vehicle[] {
  return load().vehicles;
}

export function getVehicle(id: string): Vehicle | undefined {
  return load().vehicles.find((v) => v.id === id);
}

export function getVisits(vehicleId: string): ServiceVisit[] {
  return load().visits.filter((v) => v.vehicleId === vehicleId).sort(byDateDesc);
}

export function getVisit(visitId: string): ServiceVisit | undefined {
  return load().visits.find((v) => v.id === visitId);
}

export function setVehicleMileage(vehicleId: string, mileage: number) {
  const db = load();
  const vehicle = db.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return;
  vehicle.currentMileage = mileage;
  vehicle.mileageAsOf = new Date().toISOString().slice(0, 10);
  save(db);
}

export function setVehicleNickname(vehicleId: string, nickname: string | null) {
  const db = load();
  const vehicle = db.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return;
  vehicle.nickname = nickname;
  save(db);
}

/** Match an extracted vehicle to one already in the garage, by VIN first, then year/make/model. */
export function matchVehicle(extracted: ExtractedReceipt["vehicle"]): Vehicle | undefined {
  const vehicles = getVehicles();
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

/** Persist a confirmed extraction: upsert the vehicle, append the visit. */
export function saveExtractedReceipt(
  receipt: ExtractedReceipt,
  options: { vehicleId?: string; receiptThumbnail?: string | null },
): SaveResult {
  const db = load();
  let vehicleId = options.vehicleId;

  if (vehicleId) {
    const vehicle = db.vehicles.find((v) => v.id === vehicleId);
    if (vehicle) {
      // Fill gaps from the receipt without clobbering what the user already has.
      vehicle.vin = vehicle.vin ?? receipt.vehicle.vin;
      vehicle.licensePlate = vehicle.licensePlate ?? receipt.vehicle.licensePlate;
      vehicle.year = vehicle.year ?? receipt.vehicle.year;
      if (receipt.visit.mileage != null && (vehicle.currentMileage ?? 0) < receipt.visit.mileage) {
        vehicle.currentMileage = receipt.visit.mileage;
        vehicle.mileageAsOf = receipt.visit.dateOut ?? receipt.visit.dateIn;
      }
    }
  } else {
    vehicleId = crypto.randomUUID();
    db.vehicles.push({
      ...receipt.vehicle,
      id: vehicleId,
      nickname: null,
      currentMileage: receipt.visit.mileage,
      mileageAsOf: receipt.visit.dateOut ?? receipt.visit.dateIn,
    });
  }

  const visitId = crypto.randomUUID();
  db.visits.push({
    ...receipt.visit,
    id: visitId,
    vehicleId,
    receiptThumbnail: options.receiptThumbnail ?? null,
    source: "extracted",
  });

  save(db);
  return { vehicleId, visitId };
}

export function deleteVisit(visitId: string) {
  const db = load();
  db.visits = db.visits.filter((v) => v.id !== visitId);
  save(db);
}

export function resetToSeed() {
  save({ vehicles: seedVehicles, visits: seedVisits });
}
