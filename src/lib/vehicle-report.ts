// One report per vehicle, composed from the parts.
//
// Every screen reasons from this, which is what keeps the odometer honest: the
// mileage basis is derived once and threaded into warranty math, service
// intervals, and the trust summary. A coverage screen and a service-due screen
// disagreeing about the mileage would be worse than either being slightly
// stale, and that is exactly what happens when each screen derives its own.

import type { ServiceVisit, Vehicle } from "./types";
import { analyzeMileage, currentMileageBasis, type MileageAnalysis, type MileageBasis } from "./mileage";
import { warrantyStatuses, type WarrantyStatus } from "./warranty";
import { completeness, serviceSchedule, wearSeries, type CompletenessReport, type DueItem, type WearSeries } from "./health";
import { findRepeats, type RepeatFinding } from "./repeat";
import { recordTrust, visitTrust, type RecordTrustSummary, type VisitTrust } from "./provenance";

export interface VehicleReport {
  vehicle: Vehicle;
  visits: ServiceVisit[];
  mileage: MileageAnalysis;
  basis: MileageBasis;
  coverage: WarrantyStatus[];
  activeCoverage: WarrantyStatus[];
  schedule: DueItem[];
  overdue: DueItem[];
  wear: WearSeries[];
  repeats: RepeatFinding[];
  trust: RecordTrustSummary;
  visitTrust: Map<string, VisitTrust>;
  completeness: CompletenessReport;
}

export function buildVehicleReport(vehicle: Vehicle, visits: ServiceVisit[], today = new Date()): VehicleReport {
  const mileage = analyzeMileage(vehicle, visits, today);
  const basis = currentMileageBasis(mileage);
  const coverage = warrantyStatuses(visits, basis, today);
  const schedule = serviceSchedule(visits, mileage, today);

  return {
    vehicle,
    visits,
    mileage,
    basis,
    coverage,
    activeCoverage: coverage.filter((c) => c.state !== "expired"),
    schedule,
    overdue: schedule.filter((s) => s.state === "overdue" || s.state === "due_soon"),
    wear: wearSeries(visits),
    repeats: findRepeats(visits, coverage),
    trust: recordTrust(visits, mileage, today),
    visitTrust: new Map(visits.map((v) => [v.id, visitTrust(v, today)])),
    completeness: completeness(visits, mileage, vehicle.year, today),
  };
}
