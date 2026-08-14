// Migration contract test. No API key or server required.
//
// Proves an old localStorage payload upgrades into something the current API
// will actually accept. The failure this guards against is silent: a legacy
// record that fails Zod validation at the boundary is a record the user loses
// on upgrade, in a product whose whole promise is that the history survives.
//
// Run with: node --experimental-strip-types --import ./scripts/register-ts.mjs scripts/test-migration.mjs

import { ExtractedReceiptSchema } from "../src/lib/types.ts";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? `  (${detail})` : ""}`); }
}

// A payload in the shape the old store actually wrote: no provenance, no
// partNumber, and warranty terms with only months and miles.
const legacy = {
  vehicles: [
    { id: "veh-1", year: 2016, make: "Mazda", model: "3", vin: "JM1BM1T7XG1284334",
      licensePlate: "WA BMG4770", nickname: null, currentMileage: 62786, mileageAsOf: "2026-07-15" },
  ],
  visits: [
    { id: "vis-1", vehicleId: "veh-1", source: "extracted", receiptThumbnail: "data:image/jpeg;base64,AAAA",
      shop: { name: "Pep Boys", storeNumber: "6449", address: null, phone: null },
      workOrderNumber: "2068633", dateIn: "2026-07-07", dateOut: "2026-07-15", mileage: 62786,
      serviceManager: "Jonathon Kindle", technicians: ["Jeffrey K"],
      lineItems: [{ description: "Oil change", kind: "labor", quantity: 1, unitPrice: 39.04, total: 39.04, performedBy: "Jeffrey K" }],
      totals: { parts: 65.95, labor: 59.02, fees: 6.59, tax: 13.88, total: 145.44, paymentMethod: "Visa" },
      diagnostics: null,
      warranties: [
        { description: "Parts replaced free within 6 months or 6,000 miles", coverageType: "parts", months: 6, miles: 6000, appliesTo: "Installed parts" },
        { description: "Work guaranteed", coverageType: "unknown", months: null, miles: null, appliesTo: null },
      ] },
    { id: "vis-2", vehicleId: "veh-1", source: "seed", shop: { name: "Demo", storeNumber: null, address: null, phone: null },
      workOrderNumber: null, dateIn: "2025-01-01", dateOut: null, mileage: 1, serviceManager: null,
      technicians: [], lineItems: [], totals: { parts: null, labor: null, fees: null, tax: null, total: null, paymentMethod: null },
      diagnostics: null, warranties: [] },
    { id: "vis-3", vehicleId: "veh-missing", source: "extracted", shop: { name: "Orphan", storeNumber: null, address: null, phone: null },
      workOrderNumber: null, dateIn: "2025-01-01", dateOut: null, mileage: 1, serviceManager: null,
      technicians: [], lineItems: [], totals: { parts: null, labor: null, fees: null, tax: null, total: null, paymentMethod: null },
      diagnostics: null, warranties: [] },
  ],
};

// Mirrors migrateLocalRecords, which cannot be imported here because it calls
// fetch through the store. Kept deliberately small so the two cannot drift far.
function upgradeWarranty(w) {
  return {
    description: w.description, coverageType: w.coverageType,
    duration: w.months != null || w.miles != null ? "bounded" : "unstated",
    months: w.months, miles: w.miles, prorated: false, proratedBasisMiles: null,
    transferable: null, conditions: [], appliesTo: w.appliesTo, coversLineItems: [],
  };
}

const results = [];
for (const visit of legacy.visits) {
  if (visit.source === "seed") { results.push(["skipped-seed", null]); continue; }
  const vehicle = legacy.vehicles.find((v) => v.id === visit.vehicleId);
  if (!vehicle) { results.push(["skipped-orphan", null]); continue; }
  const { id, vehicleId, source, receiptThumbnail, lineItems, warranties, ...rest } = visit;
  results.push(["migrated", {
    vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, vin: vehicle.vin, licensePlate: vehicle.licensePlate },
    visit: { ...rest, lineItems: lineItems.map((li) => ({ ...li, partNumber: li.partNumber ?? null })), warranties: warranties.map(upgradeWarranty) },
    extractionNotes: ["Migrated from this browser's local storage."],
  }]);
}

console.log("\nA legacy payload upgrades into something the API accepts");
const migrated = results.filter(([k]) => k === "migrated").map(([, r]) => r);
check("the real record is migrated", migrated.length === 1, `${migrated.length}`);
check("the demo fixture is not resurrected as the user's data", results.some(([k]) => k === "skipped-seed"));
check("a visit whose vehicle is gone is skipped, not crashed on", results.some(([k]) => k === "skipped-orphan"));

const parsed = ExtractedReceiptSchema.safeParse(migrated[0]);
check("the upgraded record passes the current schema", parsed.success,
  parsed.success ? "" : JSON.stringify(parsed.error.issues[0]));

console.log("\nThe upgrade claims nothing the old record did not say");
if (parsed.success) {
  const [bounded, unstated] = parsed.data.visit.warranties;
  check("a term with bounds becomes bounded", bounded.duration === "bounded", bounded.duration);
  check("a term with no bounds becomes unstated, not lifetime", unstated.duration === "unstated", unstated.duration);
  check("no proration is invented", parsed.data.visit.warranties.every((w) => !w.prorated));
  check("no conditions are invented", parsed.data.visit.warranties.every((w) => w.conditions.length === 0));
  check("line items gain a null part number", parsed.data.visit.lineItems.every((li) => li.partNumber === null));
  check("the migration is disclosed on the record", /migrated/i.test(parsed.data.extractionNotes[0]));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
