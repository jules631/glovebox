// Odometer continuity.
//
// Mileage is the spine of everything: warranty math, service intervals, wear
// rates, and the one number a used car buyer cares about most. It is also the
// most common point of used car fraud, which makes the shape of the curve
// evidence in its own right. A dense, monotonic curve assembled from many
// independent sources is hard to fabricate. A sparse one with a rollback in it
// tells you something no single reading can.
//
// Everything here works on readings, not visits, so a reading taken from a
// connected car API or an inspection record slots in beside a receipt.

import type { ServiceVisit, Vehicle } from "./types";

export type MileageSource = "receipt" | "owner" | "inspection" | "connected_car" | "seed";

export interface OdometerReading {
  value: number;
  /** ISO date the reading was taken. */
  date: string;
  source: MileageSource;
  /** Human readable origin, e.g. a shop name, for showing the chain of custody. */
  origin: string | null;
  visitId: string | null;
}

export type MileageAnomalyKind = "rollback" | "implausible_rate" | "stale" | "sparse" | "duplicate_conflict";

export interface MileageAnomaly {
  kind: MileageAnomalyKind;
  message: string;
  /** The readings involved, so the UI can point at evidence rather than assert. */
  readings: OdometerReading[];
  severity: "info" | "warning" | "critical";
}

export interface MileageGap {
  fromDate: string;
  toDate: string;
  fromMiles: number;
  toMiles: number;
  days: number;
  miles: number;
  /** A gap this large almost certainly contains service that was never recorded. */
  likelyUnrecordedService: boolean;
}

export interface MileageAnalysis {
  readings: OdometerReading[];
  latest: OdometerReading | null;
  /** Derived daily rate. Null when there is not enough span to say anything. */
  milesPerDay: number | null;
  milesPerYear: number | null;
  /** Best estimate of the odometer today, extrapolated from the latest reading. */
  projectedMileage: number | null;
  /** How stale the newest reading is. Warranty mileage checks inherit this. */
  daysSinceLatest: number | null;
  anomalies: MileageAnomaly[];
  gaps: MileageGap[];
  /** Distinct sources behind the curve. Independence is what makes it credible. */
  sourceCount: number;
  spanDays: number;
  readingsPerYear: number | null;
}

/** US average is roughly 13,500 miles a year. Used only when the record cannot
 *  support its own estimate, and always labeled as an assumption upstream. */
export const FALLBACK_MILES_PER_DAY = 13500 / 365;

const MS_PER_DAY = 86_400_000;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / MS_PER_DAY);
}

/** Collect every odometer reading the record can offer, newest last. */
export function mileageReadings(vehicle: Vehicle, visits: ServiceVisit[]): OdometerReading[] {
  const readings: OdometerReading[] = [];

  for (const visit of visits) {
    const date = visit.dateOut ?? visit.dateIn;
    if (visit.mileage == null || !date) continue;
    readings.push({
      value: visit.mileage,
      date,
      source: visit.provenance.method === "seed" ? "seed" : visit.provenance.method === "owner_entry" ? "owner" : "receipt",
      origin: visit.shop?.name ?? null,
      visitId: visit.id,
    });
  }

  // The owner entered current reading, kept only when it is not already
  // represented by a visit on the same day.
  if (vehicle.currentMileage != null && vehicle.mileageAsOf) {
    const dup = readings.some((r) => r.date === vehicle.mileageAsOf && r.value === vehicle.currentMileage);
    if (!dup) {
      readings.push({
        value: vehicle.currentMileage,
        date: vehicle.mileageAsOf,
        source: "owner",
        origin: "Owner entered",
        visitId: null,
      });
    }
  }

  return readings.sort((a, b) => a.date.localeCompare(b.date) || a.value - b.value);
}

/**
 * Derive a daily rate from the whole span rather than the most recent pair.
 * Two readings a month apart can imply anything; the full span is the stable
 * estimator and is what a buyer would reason from.
 */
function deriveRate(readings: OdometerReading[]): number | null {
  if (readings.length < 2) return null;
  const first = readings[0];
  const last = readings[readings.length - 1];
  const days = daysBetween(first.date, last.date);
  const miles = last.value - first.value;
  if (days < 30 || miles <= 0) return null;
  return miles / days;
}

function findAnomalies(readings: OdometerReading[], todayIso: string): MileageAnomaly[] {
  const anomalies: MileageAnomaly[] = [];
  if (!readings.length) return anomalies;

  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1];
    const cur = readings[i];

    if (cur.value < prev.value) {
      anomalies.push({
        kind: "rollback",
        message: `Reading drops from ${prev.value.toLocaleString()} on ${prev.date} to ${cur.value.toLocaleString()} on ${cur.date}. Either one of these was mistyped or the odometer went backward.`,
        readings: [prev, cur],
        severity: "critical",
      });
      continue;
    }

    const days = Math.max(daysBetween(prev.date, cur.date), 1);
    const rate = (cur.value - prev.value) / days;
    // A sustained 250 miles a day is 91,000 a year. Possible for a delivery
    // vehicle, so this is a flag to check, not a verdict.
    if (rate > 250 && days > 7) {
      anomalies.push({
        kind: "implausible_rate",
        message: `${Math.round(rate).toLocaleString()} miles a day between ${prev.date} and ${cur.date}. Worth confirming the larger reading.`,
        readings: [prev, cur],
        severity: "warning",
      });
    }

    if (prev.date === cur.date && prev.value !== cur.value) {
      anomalies.push({
        kind: "duplicate_conflict",
        message: `Two different readings recorded on ${cur.date}: ${prev.value.toLocaleString()} and ${cur.value.toLocaleString()}.`,
        readings: [prev, cur],
        severity: "warning",
      });
    }
  }

  const latest = readings[readings.length - 1];
  const stale = daysBetween(latest.date, todayIso);
  if (stale > 180) {
    anomalies.push({
      kind: "stale",
      message: `The newest odometer reading is ${stale} days old. Anything measured against mileage is only as current as this number.`,
      readings: [latest],
      severity: stale > 365 ? "warning" : "info",
    });
  }

  const span = daysBetween(readings[0].date, latest.date);
  if (span > 365 && readings.length / (span / 365) < 1) {
    anomalies.push({
      kind: "sparse",
      message: `${readings.length} readings across ${(span / 365).toFixed(1)} years. Long stretches have no odometer evidence at all.`,
      readings: [],
      severity: "info",
    });
  }

  return anomalies;
}

function findGaps(readings: OdometerReading[]): MileageGap[] {
  const gaps: MileageGap[] = [];
  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1];
    const cur = readings[i];
    const days = daysBetween(prev.date, cur.date);
    const miles = cur.value - prev.value;
    if (days < 365 && miles < 12000) continue;
    gaps.push({
      fromDate: prev.date,
      toDate: cur.date,
      fromMiles: prev.value,
      toMiles: cur.value,
      days,
      miles,
      // An oil change is due every 5,000 miles or 6 months. A gap past either
      // bound means service happened here and is not in the record, or it did
      // not happen at all. The product cannot tell which, and says so.
      likelyUnrecordedService: miles >= 7500 || days >= 270,
    });
  }
  return gaps;
}

export function analyzeMileage(vehicle: Vehicle, visits: ServiceVisit[], today = new Date()): MileageAnalysis {
  const todayIso = today.toISOString().slice(0, 10);
  const readings = mileageReadings(vehicle, visits);
  const latest = readings.length ? readings[readings.length - 1] : null;
  const milesPerDay = deriveRate(readings);
  const daysSinceLatest = latest ? daysBetween(latest.date, todayIso) : null;

  const projectedMileage =
    latest && daysSinceLatest != null
      ? Math.round(latest.value + Math.max(daysSinceLatest, 0) * (milesPerDay ?? FALLBACK_MILES_PER_DAY))
      : null;

  const spanDays = readings.length > 1 ? daysBetween(readings[0].date, readings[readings.length - 1].date) : 0;

  return {
    readings,
    latest,
    milesPerDay,
    milesPerYear: milesPerDay != null ? Math.round(milesPerDay * 365) : null,
    projectedMileage,
    daysSinceLatest,
    anomalies: findAnomalies(readings, todayIso),
    gaps: findGaps(readings),
    sourceCount: new Set(readings.map((r) => r.source)).size,
    spanDays,
    readingsPerYear: spanDays > 90 ? Number((readings.length / (spanDays / 365)).toFixed(1)) : null,
  };
}

/**
 * The mileage figure the rest of the app should reason from, with its basis
 * attached. Never return a bare number: every downstream claim needs to be able
 * to say where the number came from and how stale it is.
 */
export interface MileageBasis {
  miles: number | null;
  asOf: string | null;
  isProjected: boolean;
  daysStale: number | null;
}

export function currentMileageBasis(analysis: MileageAnalysis): MileageBasis {
  if (!analysis.latest) return { miles: null, asOf: null, isProjected: false, daysStale: null };
  const stale = analysis.daysSinceLatest ?? 0;
  // Inside a month, the measured reading is better than an extrapolation.
  if (stale <= 30 || analysis.projectedMileage == null) {
    return { miles: analysis.latest.value, asOf: analysis.latest.date, isProjected: false, daysStale: stale };
  }
  return { miles: analysis.projectedMileage, asOf: analysis.latest.date, isProjected: true, daysStale: stale };
}
