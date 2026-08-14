// Provenance and trust.
//
// A used car buyer has no reason to believe a service history the seller
// controls, and they are right not to. The person with the most incentive to
// shade the record is the person holding the phone. This is exactly why CARFAX
// excludes owner added records from the report it sells: that is not a
// capability gap, it is them protecting the integrity of the instrument.
//
// So this file does not try to make owner records trustworthy. It makes them
// legible. Every record carries how it arrived, when it was written, and
// whether anything independent corroborates it, and the summary reports the
// mix honestly rather than collapsing it into a score. A buyer can reason about
// "twelve shop originated, three photographed and payment matched, two typed by
// the owner". They cannot reason about a flat list of assertions.
//
// The design rule: make the record expensive to fake and cheap to check.

import type { IntakeMethod, ServiceVisit } from "./types";
import type { MileageAnalysis } from "./mileage";

export type TrustTier =
  /** The shop itself produced the document. Strongest available. */
  | "shop_originated"
  /** Owner photographed paper, and an independent payment record agrees. */
  | "corroborated"
  /** Owner photographed paper. Plausible, unverified. */
  | "self_captured"
  /** Owner typed it. The only source for DIY work, and the weakest evidence. */
  | "owner_asserted"
  /** Demo fixture. Never counted. */
  | "fixture";

export interface VisitTrust {
  visitId: string;
  tier: TrustTier;
  label: string;
  /** What a buyer could actually do to check this record themselves. */
  verifiableBy: string[];
  recordedAt: string;
  ageDays: number;
  amended: boolean;
}

const TIER_LABELS: Record<TrustTier, string> = {
  shop_originated: "Shop originated",
  corroborated: "Photo, payment matched",
  self_captured: "Photographed receipt",
  owner_asserted: "Owner entered",
  fixture: "Demo fixture",
};

const TIER_RANK: Record<TrustTier, number> = {
  shop_originated: 0,
  corroborated: 1,
  self_captured: 2,
  owner_asserted: 3,
  fixture: 4,
};

function tierFor(method: IntakeMethod, paymentMatched: boolean): TrustTier {
  switch (method) {
    case "shop_email":
    case "pdf":
      return "shop_originated";
    case "photo":
      return paymentMatched ? "corroborated" : "self_captured";
    case "owner_entry":
      return "owner_asserted";
    case "seed":
      return "fixture";
  }
}

function daysSince(iso: string, today: Date): number {
  return Math.max(0, Math.round((today.getTime() - Date.parse(iso)) / 86_400_000));
}

export function visitTrust(visit: ServiceVisit, today = new Date()): VisitTrust {
  const { method, paymentMatched, recordedAt, amendmentCount, hasSourceDocument } = visit.provenance;
  const tier = tierFor(method, paymentMatched);

  // Verifiability, not certification, is the mechanism. A buyer who can phone
  // the shop and read back an invoice number does not need to trust the app.
  const verifiableBy: string[] = [];
  if (visit.workOrderNumber && visit.shop.phone) {
    verifiableBy.push(`Call ${visit.shop.name} at ${visit.shop.phone} and read back work order ${visit.workOrderNumber}`);
  } else if (visit.workOrderNumber) {
    verifiableBy.push(`Work order ${visit.workOrderNumber} at ${visit.shop.name}`);
  }
  if (hasSourceDocument) verifiableBy.push("The source document is attached and can be compared line by line");
  if (paymentMatched) verifiableBy.push("A card transaction independently matches this shop, date, and amount");
  if (!verifiableBy.length) verifiableBy.push("Nothing here can be checked against an outside source");

  return {
    visitId: visit.id,
    tier,
    label: TIER_LABELS[tier],
    verifiableBy,
    recordedAt,
    ageDays: daysSince(recordedAt, today),
    amended: amendmentCount > 0,
  };
}

export interface RecordTrustSummary {
  total: number;
  byTier: Record<TrustTier, number>;
  /** Days since the oldest record was written, not since the work was done. A
   *  history that has existed for years is the hard thing to fake. */
  recordAgeDays: number | null;
  oldestRecordedAt: string | null;
  /** Independent sources behind the odometer curve. */
  odometerSources: number;
  odometerReadings: number;
  /** Odometer problems a buyer would want to know about before anything else. */
  odometerFlags: string[];
  /** Records written within the last 30 days, which on a car being sold is
   *  worth flagging plainly rather than hiding. */
  recentlyAdded: number;
  headline: string;
  caveats: string[];
}

export function recordTrust(
  visits: ServiceVisit[],
  mileageAnalysis: MileageAnalysis,
  today = new Date(),
): RecordTrustSummary {
  const trusts = visits.map((v) => visitTrust(v, today));
  const byTier: Record<TrustTier, number> = {
    shop_originated: 0,
    corroborated: 0,
    self_captured: 0,
    owner_asserted: 0,
    fixture: 0,
  };
  for (const t of trusts) byTier[t.tier]++;

  const recordedTimes = trusts.map((t) => Date.parse(t.recordedAt)).filter((n) => !Number.isNaN(n));
  const oldest = recordedTimes.length ? Math.min(...recordedTimes) : null;

  // Rollbacks and impossible jumps are the dominant used car fraud, and a dense
  // multi source curve is the cheapest defense against both.
  const odometerFlags = mileageAnalysis.anomalies
    .filter((a) => a.severity !== "info")
    .map((a) => a.message);

  const recentlyAdded = trusts.filter((t) => t.ageDays <= 30).length;

  const parts: string[] = [];
  if (byTier.shop_originated) parts.push(`${byTier.shop_originated} shop originated`);
  if (byTier.corroborated) parts.push(`${byTier.corroborated} photographed and payment matched`);
  if (byTier.self_captured) parts.push(`${byTier.self_captured} photographed`);
  if (byTier.owner_asserted) parts.push(`${byTier.owner_asserted} owner entered`);
  if (byTier.fixture) parts.push(`${byTier.fixture} demo fixture`);

  const caveats: string[] = [];
  if (byTier.owner_asserted) {
    caveats.push(
      `${byTier.owner_asserted} record${byTier.owner_asserted === 1 ? " was" : "s were"} typed by the owner with no supporting document. Treat as a claim, not evidence.`,
    );
  }
  if (recentlyAdded && recentlyAdded === trusts.length && trusts.length > 1) {
    caveats.push(
      "Every record here was entered within the last 30 days. A history assembled all at once is weaker evidence than one maintained over years.",
    );
  }
  if (mileageAnalysis.gaps.some((g) => g.likelyUnrecordedService)) {
    caveats.push("The odometer has stretches with no record. Work done there is invisible to this history.");
  }
  if (mileageAnalysis.sourceCount <= 1) {
    caveats.push("Every odometer reading comes from a single kind of source. Independent sources are what make a mileage curve hard to fabricate.");
  }

  return {
    total: trusts.length,
    byTier,
    recordAgeDays: oldest != null ? daysSince(new Date(oldest).toISOString(), today) : null,
    oldestRecordedAt: oldest != null ? new Date(oldest).toISOString() : null,
    odometerSources: mileageAnalysis.sourceCount,
    odometerReadings: mileageAnalysis.readings.length,
    odometerFlags,
    recentlyAdded,
    headline: parts.length ? `${trusts.length} records: ${parts.join(", ")}.` : "No records yet.",
    caveats,
  };
}

export function sortByTrust(trusts: VisitTrust[]): VisitTrust[] {
  return [...trusts].sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);
}
