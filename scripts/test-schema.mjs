// Schema contract test. No API key required.
//
// The risk this closes: the extraction schema gained required fields
// (duration, prorated, conditions, coversLineItems), and a required field the
// model omits fails validation at the API boundary, where the user sees only
// "extraction failed". This proves the shapes a real receipt produces all
// validate, including the ones the old model could not express.
//
// Run with: node --experimental-strip-types --import ./scripts/register-ts.mjs scripts/test-schema.mjs

import { ExtractedReceiptSchema } from "../src/lib/types.ts";
import { SYSTEM_PROMPT } from "../src/lib/extraction-prompt.ts";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? `  (${detail})` : ""}`); }
}

const baseVehicle = { year: 2016, make: "Mazda", model: "3", vin: "JM1BM1T7XG1284334", licensePlate: "WA BMG4770" };
const baseTotals = { parts: 65.95, labor: 59.02, fees: 6.59, tax: 13.88, total: 145.44, paymentMethod: "Visa ••••3911" };
const baseItem = {
  description: "Oil filter", kind: "part", quantity: 1, unitPrice: 9.99,
  total: 9.99, performedBy: null, partNumber: "PL-14459",
};

function receipt(warranties, extra = {}) {
  return {
    vehicle: baseVehicle,
    visit: {
      shop: { name: "Pep Boys", storeNumber: "6449", address: null, phone: null },
      workOrderNumber: "2068633", dateIn: "2026-07-07", dateOut: "2026-07-15",
      mileage: 62786, serviceManager: "Jonathon Kindle", technicians: ["Jeffrey K"],
      lineItems: [baseItem], totals: baseTotals, diagnostics: null,
      warranties, ...extra,
    },
    extractionNotes: [],
  };
}

const bounded = {
  description: "Installed parts replaced free if they fail within 6 months or 6,000 miles",
  coverageType: "parts", duration: "bounded", months: 6, miles: 6000,
  prorated: false, proratedBasisMiles: null, transferable: null,
  conditions: ["Original invoice required"], appliesTo: "Installed parts", coversLineItems: [0],
};

const lifetime = {
  description: "Lifetime limited warranty on brake pads for as long as the original purchaser owns the vehicle",
  coverageType: "parts", duration: "lifetime", months: null, miles: null,
  prorated: false, proratedBasisMiles: null, transferable: false,
  conditions: ["Original purchaser only", "Labor charged separately"],
  appliesTo: "Front brake pads", coversLineItems: [0],
};

const proratedTire = {
  description: "Treadwear warranty, 80,000 miles, credit prorated on unused mileage",
  coverageType: "parts", duration: "bounded", months: null, miles: 80000,
  prorated: true, proratedBasisMiles: 80000, transferable: null,
  conditions: ["Requires documented rotation every 5,000 miles"],
  appliesTo: "Tires (4)", coversLineItems: [0],
};

const unstated = {
  description: "Work guaranteed", coverageType: "unknown", duration: "unstated",
  months: null, miles: null, prorated: false, proratedBasisMiles: null,
  transferable: null, conditions: [], appliesTo: null, coversLineItems: [],
};

console.log("\nEvery coverage shape a real receipt produces must validate");
for (const [name, term] of [["bounded months and miles", bounded], ["lifetime with no bounds", lifetime], ["prorated treadwear", proratedTire], ["promised but unstated", unstated]]) {
  const r = ExtractedReceiptSchema.safeParse(receipt([term]));
  check(name, r.success, r.success ? "" : JSON.stringify(r.error.issues[0]));
}
check("several terms on one receipt", ExtractedReceiptSchema.safeParse(receipt([bounded, lifetime, proratedTire])).success);
check("a receipt with no warranty at all", ExtractedReceiptSchema.safeParse(receipt([])).success);

console.log("\nMissing required fields are caught, not silently defaulted");
const { duration: _d, ...noDuration } = bounded;
check("a term missing duration is rejected", !ExtractedReceiptSchema.safeParse(receipt([noDuration])).success);
const { conditions: _c, ...noConditions } = bounded;
check("a term missing conditions is rejected", !ExtractedReceiptSchema.safeParse(receipt([noConditions])).success);
check("an invalid duration value is rejected",
  !ExtractedReceiptSchema.safeParse(receipt([{ ...bounded, duration: "forever" }])).success);

console.log("\nThe prompt actually instructs every field the schema demands");
for (const field of ["duration", "lifetime", "prorated", "proratedBasisMiles", "conditions", "coversLineItems", "partNumber"]) {
  check(`prompt mentions ${field}`, SYSTEM_PROMPT.includes(field));
}
check("prompt tells the model not to force lifetime into months or miles",
  /do not force lifetime/i.test(SYSTEM_PROMPT));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
