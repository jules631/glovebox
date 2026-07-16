import type { ServiceVisit, Vehicle, WarrantyTerm } from "./types";

export interface WarrantyStatus {
  term: WarrantyTerm;
  visit: ServiceVisit;
  expiresDate: string | null; // ISO date
  expiresMileage: number | null;
  isActive: boolean;
  // The odometer reading the mileage check is based on, so the UI can be honest about staleness.
  mileageBasis: number | null;
}

export function latestKnownMileage(vehicle: Vehicle, visits: ServiceVisit[]): number | null {
  const readings = [vehicle.currentMileage, ...visits.map((v) => v.mileage)].filter(
    (m): m is number => m != null,
  );
  return readings.length ? Math.max(...readings) : null;
}

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * A warranty term is active when every stated bound still holds:
 * time bound   -> today <= visit date + months
 * mileage bound -> latest known odometer <= mileage at service + miles
 * Terms with neither bound can't be tracked and are never reported active.
 */
export function warrantyStatuses(vehicle: Vehicle, visits: ServiceVisit[], today = new Date()): WarrantyStatus[] {
  const basis = latestKnownMileage(vehicle, visits);
  const todayIso = today.toISOString().slice(0, 10);

  const statuses: WarrantyStatus[] = [];
  for (const visit of visits) {
    for (const term of visit.warranties) {
      const startDate = visit.dateOut ?? visit.dateIn;
      const expiresDate = term.months != null && startDate ? addMonths(startDate, term.months) : null;
      const expiresMileage = term.miles != null && visit.mileage != null ? visit.mileage + term.miles : null;

      const hasBound = expiresDate != null || expiresMileage != null;
      const dateOk = expiresDate == null || todayIso <= expiresDate;
      const mileageOk = expiresMileage == null || basis == null || basis <= expiresMileage;

      statuses.push({
        term,
        visit,
        expiresDate,
        expiresMileage,
        isActive: hasBound && dateOk && mileageOk,
        mileageBasis: basis,
      });
    }
  }
  return statuses.sort((a, b) => Number(b.isActive) - Number(a.isActive));
}

export function activeWarranties(vehicle: Vehicle, visits: ServiceVisit[], today = new Date()): WarrantyStatus[] {
  return warrantyStatuses(vehicle, visits, today).filter((s) => s.isActive);
}
