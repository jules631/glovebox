// The health model.
//
// A log answers "what happened". A health record answers "what state is the
// car in, and what happens next". The difference is entirely in this file:
// grouping measurements into a series so wear has a direction, mapping line
// items to canonical services so "last done" is answerable, and projecting an
// interval against a derived mileage rate so "due next" is a date rather than a
// vibe.
//
// One honesty constraint runs through all of it. A record with three visits in
// six years is either a neglected car or an incomplete record, and this file
// cannot tell which. It says so rather than scoring the car.

import type { Measurement, ServiceVisit } from "./types";
import { SERVICES, classifyLineItem, serviceIdentity, serviceLabel, type ServiceKey, type Axle } from "./taxonomy";
import type { MileageAnalysis } from "./mileage";
import { FALLBACK_MILES_PER_DAY } from "./mileage";

export interface PerformedService {
  key: ServiceKey;
  axle: Axle;
  identity: string;
  label: string;
  date: string | null;
  mileage: number | null;
  visitId: string;
  shopName: string;
  /** Sum of the line items that mapped to this service at this visit. */
  cost: number;
}

/** Flatten every visit into canonical services, newest first. */
export function performedServices(visits: ServiceVisit[]): PerformedService[] {
  const out: PerformedService[] = [];

  for (const visit of visits) {
    const byIdentity = new Map<string, PerformedService>();
    visit.lineItems.forEach((li) => {
      const { key, axle } = classifyLineItem(li.description, li.kind);
      if (key === "other" || key === "shop_fee") return;
      const identity = serviceIdentity(key, axle);
      const existing = byIdentity.get(identity);
      if (existing) {
        existing.cost += li.total ?? 0;
        return;
      }
      byIdentity.set(identity, {
        key,
        axle,
        identity,
        label: serviceLabel(key, axle),
        date: visit.dateOut ?? visit.dateIn,
        mileage: visit.mileage,
        visitId: visit.id,
        shopName: visit.shop.name,
        cost: li.total ?? 0,
      });
    });
    out.push(...byIdentity.values());
  }

  return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export type DueState = "overdue" | "due_soon" | "ok" | "never_recorded";

export interface DueItem {
  key: ServiceKey;
  label: string;
  state: DueState;
  lastDone: PerformedService | null;
  dueAtMileage: number | null;
  dueAtDate: string | null;
  milesUntilDue: number | null;
  daysUntilDue: number | null;
  /** Generic intervals are not the manufacturer's schedule for this VIN, and
   *  the UI is required to say so. */
  intervalSource: "generic";
}

const DUE_SOON_MILES = 750;
const DUE_SOON_DAYS = 30;

/** Services worth surfacing on a dashboard even when never recorded. */
const CORE_MAINTENANCE: ServiceKey[] = [
  "oil_change",
  "tire_rotation",
  "engine_air_filter",
  "cabin_air_filter",
  "brake_fluid",
  "transmission_fluid",
  "coolant_flush",
  "spark_plugs",
];

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

export function serviceSchedule(
  visits: ServiceVisit[],
  mileageAnalysis: MileageAnalysis,
  today = new Date(),
): DueItem[] {
  const todayIso = today.toISOString().slice(0, 10);
  const performed = performedServices(visits);
  const currentMiles = mileageAnalysis.projectedMileage ?? mileageAnalysis.latest?.value ?? null;
  const rate = mileageAnalysis.milesPerDay ?? FALLBACK_MILES_PER_DAY;

  // The most recent occurrence of each service, ignoring the axle split: a
  // rotation is a rotation regardless of which corners the receipt named.
  const lastByKey = new Map<ServiceKey, PerformedService>();
  for (const p of performed) {
    if (!lastByKey.has(p.key)) lastByKey.set(p.key, p);
  }

  const keys = new Set<ServiceKey>([...CORE_MAINTENANCE, ...lastByKey.keys()]);
  const items: DueItem[] = [];

  for (const key of keys) {
    const def = SERVICES[key];
    if (def.intervalMiles == null && def.intervalMonths == null) continue;

    const last = lastByKey.get(key) ?? null;
    if (!last || (last.mileage == null && last.date == null)) {
      items.push({
        key,
        label: def.label,
        state: "never_recorded",
        lastDone: null,
        dueAtMileage: null,
        dueAtDate: null,
        milesUntilDue: null,
        daysUntilDue: null,
        intervalSource: "generic",
      });
      continue;
    }

    const dueAtMileage =
      def.intervalMiles != null && last.mileage != null ? last.mileage + def.intervalMiles : null;
    const dueAtDate =
      def.intervalMonths != null && last.date != null ? addDays(last.date, def.intervalMonths * 30) : null;

    const milesUntilDue = dueAtMileage != null && currentMiles != null ? dueAtMileage - currentMiles : null;
    const daysUntilDue = dueAtDate != null ? daysBetween(todayIso, dueAtDate) : null;

    // Whichever bound arrives first governs, which is how every maintenance
    // schedule in the world is written.
    const daysFromMiles = milesUntilDue != null ? milesUntilDue / rate : null;
    const effectiveDays = [daysUntilDue, daysFromMiles].filter((d): d is number => d != null);
    const soonest = effectiveDays.length ? Math.min(...effectiveDays) : null;

    let state: DueState = "ok";
    if (soonest != null) {
      if (soonest < 0) state = "overdue";
      else if (soonest <= DUE_SOON_DAYS || (milesUntilDue != null && milesUntilDue <= DUE_SOON_MILES)) {
        state = "due_soon";
      }
    }

    items.push({
      key,
      label: def.label,
      state,
      lastDone: last,
      dueAtMileage,
      dueAtDate,
      milesUntilDue,
      daysUntilDue,
      intervalSource: "generic",
    });
  }

  const order: Record<DueState, number> = { overdue: 0, due_soon: 1, never_recorded: 2, ok: 3 };
  return items.sort((a, b) => order[a.state] - order[b.state] || (a.milesUntilDue ?? 0) - (b.milesUntilDue ?? 0));
}

// Wear series
//
// This is the claim the README makes and the old code did not deliver:
// measurements tracked over time. Two readings of the same corner is all it
// takes to give a number a direction.

export type WearKind = "brakeLinings" | "tireTreadDepths" | "rotorThickness";

export interface WearPoint {
  date: string;
  mileage: number | null;
  value: number;
  unit: string;
  visitId: string;
  shopName: string;
}

export interface WearSeries {
  kind: WearKind;
  position: string;
  label: string;
  unit: string;
  points: WearPoint[];
  /** Negative means wearing down. Null when there is only one reading. */
  ratePer1000Miles: number | null;
  current: number;
  /** The value at which this component is done. */
  threshold: number;
  /** Projected odometer reading at the threshold, when a rate can be derived. */
  projectedMileageAtThreshold: number | null;
  remainingMiles: number | null;
}

const WEAR_LABELS: Record<WearKind, string> = {
  brakeLinings: "Brake lining",
  tireTreadDepths: "Tire tread",
  rotorThickness: "Rotor thickness",
};

// Legal minimum tread is 2/32nds; brake pads are generally replaced at 2/32nds
// to 3/32nds. Rotors vary by vehicle, so no generic threshold is honest there.
const WEAR_THRESHOLDS: Record<WearKind, number | null> = {
  brakeLinings: 2,
  tireTreadDepths: 2,
  rotorThickness: null,
};

export function wearSeries(visits: ServiceVisit[]): WearSeries[] {
  const buckets = new Map<string, { kind: WearKind; position: string; points: WearPoint[]; unit: string }>();

  const ordered = [...visits].sort((a, b) => (a.dateIn ?? "").localeCompare(b.dateIn ?? ""));
  for (const visit of ordered) {
    if (!visit.diagnostics) continue;
    const date = visit.dateOut ?? visit.dateIn;
    if (!date) continue;

    const kinds: Array<[WearKind, Measurement[]]> = [
      ["brakeLinings", visit.diagnostics.brakeLinings],
      ["tireTreadDepths", visit.diagnostics.tireTreadDepths],
      ["rotorThickness", visit.diagnostics.rotorThickness],
    ];

    for (const [kind, measurements] of kinds) {
      for (const m of measurements) {
        const id = `${kind}:${m.position}`;
        if (!buckets.has(id)) buckets.set(id, { kind, position: m.position, points: [], unit: m.unit });
        buckets.get(id)!.points.push({
          date,
          mileage: visit.mileage,
          value: m.value,
          unit: m.unit,
          visitId: visit.id,
          shopName: visit.shop.name,
        });
      }
    }
  }

  const series: WearSeries[] = [];
  for (const bucket of buckets.values()) {
    const points = bucket.points;
    const first = points[0];
    const last = points[points.length - 1];
    const threshold = WEAR_THRESHOLDS[bucket.kind];

    let ratePer1000Miles: number | null = null;
    if (points.length >= 2 && first.mileage != null && last.mileage != null) {
      const miles = last.mileage - first.mileage;
      // Under a few thousand miles the noise in a hand-taken measurement
      // swamps the signal, so no rate is better than a fabricated one.
      if (miles >= 2000) ratePer1000Miles = ((last.value - first.value) / miles) * 1000;
    }

    const wearingDown = ratePer1000Miles != null && ratePer1000Miles < 0;
    const remainingMiles =
      wearingDown && threshold != null ? ((last.value - threshold) / -ratePer1000Miles!) * 1000 : null;

    series.push({
      kind: bucket.kind,
      position: bucket.position,
      label: `${WEAR_LABELS[bucket.kind]}, ${bucket.position.replace("-", " ")}`,
      unit: bucket.unit,
      points,
      ratePer1000Miles,
      current: last.value,
      threshold: threshold ?? 0,
      projectedMileageAtThreshold:
        remainingMiles != null && last.mileage != null ? Math.round(last.mileage + remainingMiles) : null,
      remainingMiles: remainingMiles != null ? Math.round(remainingMiles) : null,
    });
  }

  return series.sort((a, b) => a.label.localeCompare(b.label));
}

// Completeness
//
// The single most important thing this file refuses to do is call a thin record
// a badly maintained car.

export interface CompletenessReport {
  visitCount: number;
  distinctShops: number;
  firstRecordDate: string | null;
  lastRecordDate: string | null;
  /** Stretches of mileage with no record at all. */
  unrecordedStretches: number;
  /** Core maintenance the record has never once seen. */
  neverRecorded: string[];
  /** How much of the car's life the record actually covers, 0 to 1, when the
   *  car's age can be established. */
  coverageOfKnownLife: number | null;
  verdict: "thorough" | "partial" | "sparse";
  /** Written for a human, and careful about what it cannot know. */
  summary: string;
}

export function completeness(
  visits: ServiceVisit[],
  mileageAnalysis: MileageAnalysis,
  vehicleYear: number | null,
  today = new Date(),
): CompletenessReport {
  const dated = visits.map((v) => v.dateOut ?? v.dateIn).filter((d): d is string => d != null).sort();
  const performed = performedServices(visits);
  const seen = new Set(performed.map((p) => p.key));
  const neverRecorded = CORE_MAINTENANCE.filter((k) => !seen.has(k)).map((k) => SERVICES[k].label);
  const unrecordedStretches = mileageAnalysis.gaps.filter((g) => g.likelyUnrecordedService).length;

  // Oil changes are the metronome of a service record: roughly two a year on a
  // normally driven car. Comparing recorded visits against the car's age is the
  // cheapest honest measure of how much of its life the record covers.
  let coverageOfKnownLife: number | null = null;
  if (vehicleYear != null && dated.length) {
    const ageYears = today.getUTCFullYear() - vehicleYear;
    if (ageYears > 0) {
      const recordedYears = (Date.parse(dated[dated.length - 1]) - Date.parse(dated[0])) / (365 * 86_400_000);
      coverageOfKnownLife = Math.max(0, Math.min(1, recordedYears / ageYears));
    }
  }

  const visitsPerYear = mileageAnalysis.readingsPerYear ?? null;
  let verdict: CompletenessReport["verdict"] = "partial";
  if (unrecordedStretches === 0 && visitsPerYear != null && visitsPerYear >= 2 && neverRecorded.length <= 2) {
    verdict = "thorough";
  } else if (visits.length < 3 || (visitsPerYear != null && visitsPerYear < 1) || unrecordedStretches >= 2) {
    verdict = "sparse";
  }

  const parts: string[] = [`${visits.length} visits across ${new Set(visits.map((v) => v.shop.name)).size} shops`];
  if (dated.length) parts.push(`from ${dated[0]} to ${dated[dated.length - 1]}`);

  let summary = `${parts.join(", ")}.`;
  if (unrecordedStretches > 0) {
    summary += ` ${unrecordedStretches} stretch${unrecordedStretches > 1 ? "es" : ""} of the odometer ${
      unrecordedStretches > 1 ? "have" : "has"
    } no record at all.`;
  }
  if (neverRecorded.length) {
    summary += ` No record has ever been captured for ${neverRecorded.slice(0, 3).join(", ").toLowerCase()}.`;
  }
  // The load-bearing sentence. Absence of evidence is not evidence of neglect,
  // and a product that blurs the two will misprice a well kept car.
  summary +=
    verdict === "thorough"
      ? " The record is dense enough to reason from."
      : " A gap here means the work was done somewhere this record cannot see, or it was not done. This cannot tell the difference, and neither can anyone else without the missing receipts.";

  return {
    visitCount: visits.length,
    distinctShops: new Set(visits.map((v) => v.shop.name)).size,
    firstRecordDate: dated[0] ?? null,
    lastRecordDate: dated[dated.length - 1] ?? null,
    unrecordedStretches,
    neverRecorded,
    coverageOfKnownLife,
    verdict,
    summary,
  };
}
