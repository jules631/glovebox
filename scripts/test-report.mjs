// End to end smoke test over the composed vehicle report. No API key required.
// Run with: node --experimental-strip-types scripts/test-report.mjs

import { buildVehicleReport } from "../src/lib/vehicle-report.ts";
import { checkBeforeYouPay } from "../src/lib/repeat.ts";
import { seedVehicles, seedVisits } from "../src/lib/seed.ts";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail !== undefined ? `  (${detail})` : ""}`); }
}

const today = new Date("2026-08-13T12:00:00Z");
const mazda = seedVehicles.find((v) => v.id === "veh-mazda3");
const visits = seedVisits.filter((v) => v.vehicleId === "veh-mazda3");
const r = buildVehicleReport(mazda, visits, today);

console.log("\nThe odometer curve has a shape, not just a number");
check("readings collected across visits", r.mileage.readings.length >= 4, r.mileage.readings.length);
check("a mileage rate was derived", r.mileage.milesPerDay != null, r.mileage.milesPerYear + " mi/yr");
// Inside a month the measured reading beats an extrapolation, so this asserts
// the rule rather than one side of it.
check("a fresh reading is used as measured, a stale one is projected",
  r.basis.daysStale <= 30 ? r.basis.isProjected === false : r.basis.isProjected === true,
  `${r.basis.daysStale} days stale, projected=${r.basis.isProjected}`);
check("the basis says how stale it is", r.basis.daysStale > 0, r.basis.daysStale + " days");
check("no rollback in clean seed data", !r.mileage.anomalies.some((a) => a.kind === "rollback"));

console.log("\nWear has a direction, which is the claim the README makes");
check("wear series were built", r.wear.length > 0, r.wear.length + " series");
const withRate = r.wear.filter((w) => w.ratePer1000Miles != null);
check("at least one series has a derived rate", withRate.length > 0, withRate.length);
const tread = withRate.find((w) => w.kind === "tireTreadDepths");
check("tire tread is wearing down, not up", tread ? tread.ratePer1000Miles < 0 : false, tread?.ratePer1000Miles?.toFixed(3));
check("tread projects a mileage at the legal 2/32 limit", tread?.projectedMileageAtThreshold != null, tread?.projectedMileageAtThreshold);

console.log("\nDue next is answerable");
check("a schedule was produced", r.schedule.length > 0, r.schedule.length + " items");
check("intervals are labeled generic, never as the manufacturer's", r.schedule.every((s) => s.intervalSource === "generic"));
check("something is flagged overdue or due soon", r.overdue.length > 0, r.overdue.map((o) => o.label).join(", "));

console.log("\nCompleteness refuses to call a thin record a neglected car");
check("a verdict was reached", ["thorough", "partial", "sparse"].includes(r.completeness.verdict), r.completeness.verdict);
check("the summary states the ambiguity out loud",
  r.completeness.verdict === "thorough" || r.completeness.summary.includes("cannot tell the difference"));

console.log("\nTrust reports the mix rather than a score");
check("every visit got a tier", r.visitTrust.size === visits.length);
check("seed records are marked as fixtures, never counted as evidence", r.trust.byTier.fixture === visits.length);
check("caveats are raised, not buried", r.trust.caveats.length > 0, r.trust.caveats.length + " caveats");

console.log("\nThe counter check answers before the money is spent");
const brakes = checkBeforeYouPay("brake_pads", "front", visits, r.coverage, r.basis.miles, today);
check("it found the earlier brake job", brakes.lastDone != null, brakes.lastDone?.shopName);
check("it says to ask first, because coverage is standing", brakes.verdict === "ask_first", brakes.verdict);
check("it quotes the receipt rather than asserting coverage, leading with the strongest term",
  /lifetime/i.test(brakes.message) && brakes.message.includes("receipt says"), brakes.message.slice(0, 90));

const unknown = checkBeforeYouPay("timing_belt", null, visits, r.coverage, r.basis.miles, today);
check("no history is reported as no history, not as never done", unknown.verdict === "no_history" && unknown.message.includes("does not mean it was never done"));

console.log("\nInferred repeat windows are discounted, because a false alarm is the costly error");
import { findRepeats } from "../src/lib/repeat.ts";
// Same work twice, 20 months apart, with no terms printed on the earlier receipt.
// The generic window for brake pads is 24 months, so an undiscounted check would
// raise this; at 70% the limit is 16.8 months and it stays quiet.
const bare = (id, date, mileage) => ({
  id, vehicleId: "v", shop: { name: `Shop ${id}`, storeNumber: null, address: null, phone: null },
  workOrderNumber: null, dateIn: date, dateOut: date, mileage, serviceManager: null, technicians: [],
  lineItems: [{ description: "Front brake pads", kind: "part", quantity: 1, unitPrice: 200, total: 200, performedBy: null, partNumber: null }],
  totals: { parts: 200, labor: null, fees: null, tax: null, total: 200, paymentMethod: null },
  diagnostics: null, warranties: [], receiptThumbnail: null,
  provenance: { method: "photo", recordedAt: "2026-01-01T00:00:00Z", amendedAt: null, amendmentCount: 0, paymentMatched: false, hasSourceDocument: false },
});
const nearEdge = findRepeats([bare("a", "2024-01-01", 10000), bare("b", "2025-09-01", 15000)], []);
check("a repeat past the discounted generic window stays quiet", nearEdge.length === 0, `${nearEdge.length} raised`);
const wellInside = findRepeats([bare("a", "2025-06-01", 10000), bare("b", "2025-12-01", 13000)], []);
check("a repeat well inside it is still raised", wellInside.length === 1, `${wellInside.length} raised`);
check("and is labeled inferred rather than stated", wellInside[0]?.confidence === "inferred", wellInside[0]?.confidence);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
