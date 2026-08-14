// Coverage tracking.
//
// The governing rule here is that this file never asserts that something is
// covered. It reports what the receipt said, what the arithmetic on those
// stated bounds comes to, and what the shop still gets to decide. The shop
// honors its own system record, not an app, so the useful output is a claim
// packet the owner can put on the counter, not a verdict.
//
// The previous version could only express "months or miles", which meant the
// single most valuable coverage a driver has, a lifetime brake pad warranty,
// was silently unreportable. Duration, proration, and conditions are now
// modeled separately so that nothing printed on the receipt is dropped.

import type { LineItem, ServiceVisit, WarrantyTerm } from "./types";
import type { MileageBasis } from "./mileage";

export type CoverageState =
  /** Every stated bound still holds. */
  | "active"
  /** A stated bound has been passed. */
  | "expired"
  /** The receipt promised coverage but printed nothing that can be checked. */
  | "not_computable";

export interface Proration {
  basisMiles: number;
  milesUsed: number;
  /** Share of the warranted life left, 0 to 1. */
  fractionRemaining: number;
  /** What was originally paid for the covered parts, when the receipt shows it. */
  pricePaid: number | null;
  /** Illustrative credit, not an offer. The shop prorates against its own
   *  current selling price, which we do not know. */
  estimatedCredit: number | null;
}

export interface ClaimPacket {
  shopName: string;
  storeNumber: string | null;
  shopPhone: string | null;
  workOrderNumber: string | null;
  serviceDate: string | null;
  serviceMileage: number | null;
  /** The warranty sentence exactly as the extractor condensed it. */
  quotedTerms: string;
  partNumbers: string[];
  coveredItems: string[];
  amountPaid: number | null;
}

export interface WarrantyStatus {
  term: WarrantyTerm;
  visit: ServiceVisit;
  /** Line items this term names, resolved from coversLineItems. */
  coveredItems: LineItem[];
  expiresDate: string | null;
  expiresMileage: number | null;
  state: CoverageState;
  /** Why the state is what it is, in the plainest terms available. */
  explanation: string;
  daysRemaining: number | null;
  milesRemaining: number | null;
  /** The odometer reading the mileage check rests on, so the UI can be honest
   *  about how stale that number is. */
  mileageBasis: number | null;
  mileageBasisIsProjected: boolean;
  proration: Proration | null;
  /** Conditions the receipt attached. These are the shop's call, never ours. */
  conditions: string[];
  claim: ClaimPacket;
}

const MS_PER_DAY = 86_400_000;

/**
 * Add months without JS month rollover.
 *
 * The naive setMonth walks January 31 plus one month to March 3, which quietly
 * hands the owner two extra days of coverage that the receipt never promised.
 * Clamping to the last valid day of the target month is what a shop means by
 * "six months from today".
 */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const targetMonthIndex = m - 1 + months;
  const year = y + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDayOfTarget);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / MS_PER_DAY);
}

function resolveCoveredItems(term: WarrantyTerm, visit: ServiceVisit): LineItem[] {
  if (!term.coversLineItems.length) return [];
  return term.coversLineItems.map((i) => visit.lineItems[i]).filter((li): li is LineItem => li != null);
}

function buildProration(
  term: WarrantyTerm,
  visit: ServiceVisit,
  coveredItems: LineItem[],
  basis: number | null,
): Proration | null {
  if (!term.prorated) return null;
  const basisMiles = term.proratedBasisMiles ?? term.miles;
  if (basisMiles == null || visit.mileage == null || basis == null) return null;

  const milesUsed = Math.max(0, basis - visit.mileage);
  const fractionRemaining = Math.max(0, Math.min(1, 1 - milesUsed / basisMiles));
  const pricePaid = coveredItems.length
    ? coveredItems.reduce((sum, li) => sum + (li.total ?? 0), 0) || null
    : null;

  return {
    basisMiles,
    milesUsed,
    fractionRemaining,
    pricePaid,
    estimatedCredit: pricePaid != null ? Math.round(pricePaid * fractionRemaining * 100) / 100 : null,
  };
}

function buildClaim(term: WarrantyTerm, visit: ServiceVisit, coveredItems: LineItem[]): ClaimPacket {
  const items = coveredItems.length ? coveredItems : visit.lineItems.filter((li) => li.kind === "part");
  return {
    shopName: visit.shop.name,
    storeNumber: visit.shop.storeNumber,
    shopPhone: visit.shop.phone,
    workOrderNumber: visit.workOrderNumber,
    serviceDate: visit.dateOut ?? visit.dateIn,
    serviceMileage: visit.mileage,
    quotedTerms: term.description,
    partNumbers: items.map((li) => li.partNumber).filter((p): p is string => p != null),
    coveredItems: items.map((li) => li.description),
    amountPaid: visit.totals.total,
  };
}

interface Evaluation {
  state: CoverageState;
  explanation: string;
}

function evaluate(
  term: WarrantyTerm,
  expiresDate: string | null,
  expiresMileage: number | null,
  todayIso: string,
  basis: number | null,
): Evaluation {
  const dateExpired = expiresDate != null && todayIso > expiresDate;
  const mileageExpired = expiresMileage != null && basis != null && basis > expiresMileage;

  if (dateExpired && mileageExpired) {
    return { state: "expired", explanation: `Past both the ${expiresDate} date and the ${expiresMileage!.toLocaleString()} mile limit.` };
  }
  if (dateExpired) return { state: "expired", explanation: `The stated term ran out on ${expiresDate}.` };
  if (mileageExpired) {
    return { state: "expired", explanation: `The odometer is past the ${expiresMileage!.toLocaleString()} mile limit.` };
  }

  // Lifetime coverage has nothing to expire. The old model treated an unbounded
  // term as untrackable and reported it inactive, which hid the most valuable
  // thing on the receipt.
  if (term.duration === "lifetime") {
    return { state: "active", explanation: "The receipt states lifetime coverage, with no date or mileage limit." };
  }

  if (expiresDate == null && expiresMileage == null) {
    return {
      state: "not_computable",
      explanation:
        term.duration === "unstated"
          ? "The receipt promises coverage but does not print a limit. Ask the shop what applies."
          : "No date or mileage limit could be read from the receipt.",
    };
  }

  // A mileage bound we cannot check is not the same as a mileage bound that
  // passed. Say which one it is.
  if (expiresMileage != null && basis == null && expiresDate == null) {
    return { state: "not_computable", explanation: "Coverage runs on mileage, and there is no odometer reading to check it against." };
  }

  const parts: string[] = [];
  if (expiresDate) parts.push(`through ${expiresDate}`);
  if (expiresMileage) parts.push(`up to ${expiresMileage.toLocaleString()} miles`);
  return { state: "active", explanation: `Within the stated terms: ${parts.join(" and ")}.` };
}

/**
 * Coverage for every term on every visit.
 *
 * The odometer basis is passed in rather than derived here, so that one reading
 * governs the whole app. A warranty screen and a service-due screen disagreeing
 * about the mileage is worse than either of them being slightly stale.
 */
export function warrantyStatuses(
  visits: ServiceVisit[],
  mileage: MileageBasis,
  today = new Date(),
): WarrantyStatus[] {
  const basis = mileage.miles;
  const isProjected = mileage.isProjected;
  const todayIso = today.toISOString().slice(0, 10);

  const statuses: WarrantyStatus[] = [];
  for (const visit of visits) {
    for (const term of visit.warranties) {
      const startDate = visit.dateOut ?? visit.dateIn;
      const expiresDate =
        term.duration === "lifetime" || term.months == null || !startDate
          ? null
          : addMonths(startDate, term.months);
      const expiresMileage =
        term.duration === "lifetime" || term.miles == null || visit.mileage == null
          ? null
          : visit.mileage + term.miles;

      const { state, explanation } = evaluate(term, expiresDate, expiresMileage, todayIso, basis);
      const coveredItems = resolveCoveredItems(term, visit);

      statuses.push({
        term,
        visit,
        coveredItems,
        expiresDate,
        expiresMileage,
        state,
        explanation,
        daysRemaining: expiresDate ? daysBetween(todayIso, expiresDate) : null,
        milesRemaining: expiresMileage != null && basis != null ? expiresMileage - basis : null,
        mileageBasis: basis,
        mileageBasisIsProjected: isProjected,
        proration: buildProration(term, visit, coveredItems, basis),
        conditions: term.conditions,
        claim: buildClaim(term, visit, coveredItems),
      });
    }
  }

  const order: Record<CoverageState, number> = { active: 0, not_computable: 1, expired: 2 };
  return statuses.sort((a, b) => order[a.state] - order[b.state]);
}

/**
 * Coverage worth showing the owner. Deliberately includes terms we cannot
 * compute: a false negative here means someone pays for work that was already
 * covered, which is the exact failure this product exists to prevent.
 */
export function activeWarranties(
  visits: ServiceVisit[],
  mileage: MileageBasis,
  today = new Date(),
): WarrantyStatus[] {
  return warrantyStatuses(visits, mileage, today).filter((s) => s.state !== "expired");
}
