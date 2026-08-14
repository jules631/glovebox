// The do-not-pay-twice check.
//
// This is the founding story in the README, and it is the one feature that
// works without parsing a single warranty correctly. It needs only two things
// the extractor already gets right: what was done, and when. If the same system
// was paid for twice inside a plausible coverage window, that is worth knowing
// whether or not the fine print was legible.
//
// Two entry points, and the second one matters more:
//   - findRepeats: what already happened, shown after the fact
//   - checkBeforeYouPay: what a shop just quoted, answered at the counter
// The second is the only moment in this product where the answer is worth money
// before it is spent.

import type { ServiceVisit } from "./types";
import { SERVICES, serviceLabel, type ServiceKey, type Axle } from "./taxonomy";
import { performedServices, type PerformedService } from "./health";
import type { WarrantyStatus } from "./warranty";

export interface RepeatFinding {
  identity: string;
  label: string;
  earlier: PerformedService;
  later: PerformedService;
  monthsApart: number | null;
  milesApart: number | null;
  /** The window used, and where it came from. A window taken from the receipt
   *  is a much stronger claim than one taken from a generic default. */
  windowSource: "receipt" | "typical";
  windowMonths: number | null;
  windowMiles: number | null;
  /** True when the two shops differ, which is exactly the case no single shop
   *  can see and the whole reason this record exists. */
  crossShop: boolean;
  amountAtRisk: number;
  /** "stated" when the earlier receipt printed its own terms, so the window is
   *  the shop's own promise. "inferred" when it did not, and the window is a
   *  generic default this product chose. The two deserve different language
   *  and different confidence, and conflating them is how a useful alert
   *  becomes a nagging one. */
  confidence: "stated" | "inferred";
  summary: string;
}

/**
 * How much of a generic window to actually trust.
 *
 * At the edge of an invented window the signal is weakest and a false alarm is
 * most likely, so an inferred window is discounted before it can raise
 * anything. A receipt that states its own terms is used in full, because that
 * is the shop's promise rather than our guess.
 */
const INFERRED_WINDOW_DISCOUNT = 0.7;

function monthsBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am) - (bd < ad ? 1 : 0);
}

/**
 * The window in which a second charge for the same work is suspicious.
 * Prefers what the earlier receipt actually promised; falls back to what this
 * kind of work is normally warranted for.
 */
function coverageWindow(
  key: ServiceKey,
  earlierVisitId: string,
  warranties: WarrantyStatus[],
): { months: number | null; miles: number | null; source: "receipt" | "typical" } {
  const fromReceipt = warranties.filter((w) => w.visit.id === earlierVisitId);
  if (fromReceipt.length) {
    // Lifetime coverage makes any repeat charge for the same part worth asking
    // about, no matter how long ago the original work was.
    if (fromReceipt.some((w) => w.term.duration === "lifetime")) {
      return { months: null, miles: null, source: "receipt" };
    }
    const months = Math.max(...fromReceipt.map((w) => w.term.months ?? 0));
    const miles = Math.max(...fromReceipt.map((w) => w.term.miles ?? 0));
    if (months > 0 || miles > 0) {
      return { months: months || null, miles: miles || null, source: "receipt" };
    }
  }
  const def = SERVICES[key];
  return { months: def.typicalWarrantyMonths, miles: def.typicalWarrantyMiles, source: "typical" };
}

export function findRepeats(visits: ServiceVisit[], warranties: WarrantyStatus[]): RepeatFinding[] {
  const performed = performedServices(visits);
  const byIdentity = new Map<string, PerformedService[]>();
  for (const p of performed) {
    // Routine maintenance repeating is the point, not a problem.
    if (SERVICES[p.key].kind === "maintenance" || SERVICES[p.key].kind === "inspection") continue;
    if (!byIdentity.has(p.identity)) byIdentity.set(p.identity, []);
    byIdentity.get(p.identity)!.push(p);
  }

  const findings: RepeatFinding[] = [];
  for (const [identity, occurrences] of byIdentity) {
    if (occurrences.length < 2) continue;
    const chronological = [...occurrences].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

    for (let i = 1; i < chronological.length; i++) {
      const earlier = chronological[i - 1];
      const later = chronological[i];
      const window = coverageWindow(earlier.key, earlier.visitId, warranties);

      const monthsApart = earlier.date && later.date ? monthsBetween(earlier.date, later.date) : null;
      const milesApart =
        earlier.mileage != null && later.mileage != null ? later.mileage - earlier.mileage : null;

      // Lifetime coverage means no window to fall outside of.
      const isLifetime = window.months == null && window.miles == null && window.source === "receipt";
      const discount = window.source === "receipt" ? 1 : INFERRED_WINDOW_DISCOUNT;
      const monthLimit = window.months != null ? window.months * discount : null;
      const mileLimit = window.miles != null ? window.miles * discount : null;

      // "6 months or 6,000 miles" means whichever comes FIRST, so coverage is
      // plausible only while every stated bound still holds. Treating the
      // bounds as alternatives instead of limits would flag a brake job redone
      // two years later purely because the car had been driven very little,
      // which is exactly the false alarm that teaches people to ignore this.
      const bounds: boolean[] = [];
      if (monthLimit != null && monthsApart != null) bounds.push(monthsApart <= monthLimit);
      if (mileLimit != null && milesApart != null) bounds.push(milesApart <= mileLimit);
      const withinWindow = bounds.length > 0 && bounds.every(Boolean);
      if (!isLifetime && !withinWindow) continue;

      const crossShop = earlier.shopName !== later.shopName;
      const bits: string[] = [];
      if (monthsApart != null) bits.push(`${monthsApart} month${monthsApart === 1 ? "" : "s"}`);
      if (milesApart != null) bits.push(`${milesApart.toLocaleString()} miles`);

      const promise = isLifetime
        ? `${earlier.shopName} recorded lifetime coverage on that work`
        : window.source === "receipt"
          ? `${earlier.shopName}'s receipt stated coverage for ${[
              window.months ? `${window.months} months` : null,
              window.miles ? `${window.miles.toLocaleString()} miles` : null,
            ]
              .filter(Boolean)
              .join(" or ")}`
          : `work like this is commonly warranted for around ${[
              window.months ? `${window.months} months` : null,
              window.miles ? `${window.miles.toLocaleString()} miles` : null,
            ]
              .filter(Boolean)
              .join(" or ")}`;

      findings.push({
        identity,
        label: serviceLabel(earlier.key, earlier.axle),
        earlier,
        later,
        monthsApart,
        milesApart,
        windowSource: window.source,
        windowMonths: window.months,
        windowMiles: window.miles,
        crossShop,
        confidence: window.source === "receipt" ? "stated" : "inferred",
        amountAtRisk: later.cost,
        summary:
          `You paid ${later.shopName} for ${serviceLabel(earlier.key, earlier.axle).toLowerCase()} ` +
          `${bits.join(" and ")} after paying ${earlier.shopName} for the same work, and ${promise}.` +
          (crossShop ? " Neither shop could see the other's record." : ""),
      });
    }
  }

  return findings.sort((a, b) => b.amountAtRisk - a.amountAtRisk);
}

// The counter check
//
// A shop just quoted work. Before authorizing it, this answers: when was this
// last done, what did it cost, and did anyone promise to cover it.

export type CounterVerdict = "ask_first" | "recently_done" | "no_history";

export interface CounterCheck {
  key: ServiceKey;
  label: string;
  verdict: CounterVerdict;
  lastDone: PerformedService | null;
  monthsSince: number | null;
  milesSince: number | null;
  /** Coverage from the earlier visit that has not expired. */
  standingCoverage: WarrantyStatus[];
  /** What to actually say at the counter. */
  message: string;
}

export function checkBeforeYouPay(
  key: ServiceKey,
  axle: Axle,
  visits: ServiceVisit[],
  warranties: WarrantyStatus[],
  currentMileage: number | null,
  today = new Date(),
): CounterCheck {
  const todayIso = today.toISOString().slice(0, 10);
  const label = serviceLabel(key, axle);
  const performed = performedServices(visits).filter((p) => p.key === key);
  const lastDone = performed[0] ?? null;

  if (!lastDone) {
    return {
      key,
      label,
      verdict: "no_history",
      lastDone: null,
      monthsSince: null,
      milesSince: null,
      standingCoverage: [],
      message: `No record of ${label.toLowerCase()} on this vehicle. That does not mean it was never done, only that this record has never seen it.`,
    };
  }

  const monthsSince = lastDone.date ? monthsBetween(lastDone.date, todayIso) : null;
  const milesSince =
    lastDone.mileage != null && currentMileage != null ? currentMileage - lastDone.mileage : null;

  // Strongest coverage first. At a counter you get one sentence in before the
  // service advisor moves on, and lifetime coverage is the sentence to spend it
  // on. Sorting by what the receipt promised rather than by array order is the
  // difference between a useful prompt and a technically correct one.
  const standingCoverage = warranties
    .filter((w) => w.visit.id === lastDone.visitId && w.state !== "expired")
    .sort((a, b) => {
      if (a.term.duration !== b.term.duration) {
        if (a.term.duration === "lifetime") return -1;
        if (b.term.duration === "lifetime") return 1;
      }
      return (b.term.months ?? 0) - (a.term.months ?? 0);
    });

  const def = SERVICES[key];
  const withinInterval =
    (def.intervalMiles != null && milesSince != null && milesSince < def.intervalMiles) ||
    (def.intervalMonths != null && monthsSince != null && monthsSince < def.intervalMonths);

  const since = [
    monthsSince != null ? `${monthsSince} month${monthsSince === 1 ? "" : "s"}` : null,
    milesSince != null ? `${milesSince.toLocaleString()} miles` : null,
  ]
    .filter(Boolean)
    .join(" and ");

  if (standingCoverage.length) {
    const quoted = standingCoverage[0].term.description;
    return {
      key,
      label,
      verdict: "ask_first",
      lastDone,
      monthsSince,
      milesSince,
      standingCoverage,
      message:
        `${lastDone.shopName} did this ${since} ago for $${lastDone.cost.toFixed(2)}, and that receipt says: "${quoted}" ` +
        `Ask this shop whether the earlier work is covered before authorizing it.`,
    };
  }

  if (withinInterval) {
    return {
      key,
      label,
      verdict: "recently_done",
      lastDone,
      monthsSince,
      milesSince,
      standingCoverage: [],
      message: `${lastDone.shopName} did this ${since} ago for $${lastDone.cost.toFixed(2)}, which is inside the usual interval. Worth asking why it is due again.`,
    };
  }

  return {
    key,
    label,
    verdict: "no_history",
    lastDone,
    monthsSince,
    milesSince,
    standingCoverage: [],
    message: `Last done by ${lastDone.shopName} ${since} ago for $${lastDone.cost.toFixed(2)}. No coverage from that visit is still standing.`,
  };
}
