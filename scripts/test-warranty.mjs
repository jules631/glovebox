// Warranty engine smoke test. No API key required.
// Run with: node --experimental-strip-types scripts/test-warranty.mjs

import { addMonths, warrantyStatuses } from "../src/lib/warranty.ts";
import { analyzeMileage, currentMileageBasis } from "../src/lib/mileage.ts";
import { seedVehicles, seedVisits } from "../src/lib/seed.ts";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? `  (${detail})` : ""}`); }
}

console.log("\naddMonths does not roll over the end of the month");
check("2026-01-31 + 1 month is 2026-02-28", addMonths("2026-01-31", 1) === "2026-02-28", addMonths("2026-01-31", 1));
check("2024-01-31 + 1 month is 2024-02-29 in a leap year", addMonths("2024-01-31", 1) === "2024-02-29", addMonths("2024-01-31", 1));
check("2026-08-31 + 6 months is 2027-02-28", addMonths("2026-08-31", 6) === "2027-02-28", addMonths("2026-08-31", 6));
check("2026-03-15 + 12 months is 2027-03-15", addMonths("2026-03-15", 12) === "2027-03-15", addMonths("2026-03-15", 12));

const today = new Date("2026-08-13T12:00:00Z");
const mazda = seedVehicles.find((v) => v.id === "veh-mazda3");
const visits = seedVisits.filter((v) => v.vehicleId === "veh-mazda3");
const basis = currentMileageBasis(analyzeMileage(mazda, visits, today));
const statuses = warrantyStatuses(visits, basis, today);

console.log("\nLifetime coverage is reported, not silently dropped");
const lifetime = statuses.find((s) => s.term.duration === "lifetime");
check("the lifetime brake pad term exists", !!lifetime);
check("it is active despite having no bounds", lifetime?.state === "active", lifetime?.state);
check("its conditions survive to the UI", (lifetime?.conditions.length ?? 0) >= 3, `${lifetime?.conditions.length} conditions`);
check("it carries a claim packet with an invoice number", lifetime?.claim.workOrderNumber === "GY-118276", lifetime?.claim.workOrderNumber);
check("the claim packet carries the part number", lifetime?.claim.partNumbers.includes("WAG-ZD1521"));

console.log("\nProrated coverage reports a share, not a yes or no");
const tire = statuses.find((s) => s.term.prorated);
check("the tire treadwear term is prorated", !!tire?.proration);
check("it knows the warranted basis", tire?.proration?.basisMiles === 80000, String(tire?.proration?.basisMiles));
check("it computed miles used since install", tire?.proration?.milesUsed > 0, String(tire?.proration?.milesUsed));
check("remaining share is between 0 and 1", tire?.proration?.fractionRemaining > 0 && tire?.proration?.fractionRemaining < 1, String(tire?.proration?.fractionRemaining));
check("it estimates a credit from what was paid", (tire?.proration?.estimatedCredit ?? 0) > 0, String(tire?.proration?.estimatedCredit));

console.log("\nEvery status explains itself and shows its mileage basis");
check("no status is missing an explanation", statuses.every((s) => s.explanation.length > 0));
check("every status carries the odometer it was judged against", statuses.every((s) => s.mileageBasis != null));

console.log("\nExpiry still works on ordinary bounded terms");
const expired = statuses.filter((s) => s.state === "expired");
const active = statuses.filter((s) => s.state === "active");
check("some bounded terms have expired", expired.length > 0, `${expired.length} expired`);
check("some terms are still active", active.length > 0, `${active.length} active`);
check("the Mazda dealer 12mo/12k term from 2024 is expired",
  statuses.some((s) => s.visit.id === "vis-mazda-dealer-2024-08" && s.state === "expired"));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
