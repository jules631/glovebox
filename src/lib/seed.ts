import type { ExtractedReceipt, ServiceVisit, Vehicle } from "./types";

// The demo garage. Loaded only when someone asks for it, never automatically,
// so a real first-time visitor sees their own empty garage rather than these
// cars.
//
// What is real and what is not, because a product about provenance should not
// be vague about its own:
//
//   - The July 2026 Pep Boys visit (work order 2068633) is transcribed from a
//     real invoice. Its line items, totals, inspection readings, and warranty
//     terms are what the paper says. The same document is the ground truth for
//     the extraction eval in validation/fixtures.
//   - Every other visit is composed. They are shaped to exercise coverage that
//     really exists in the market but happens not to appear on that one
//     invoice: a chain lifetime brake warranty with an original-purchaser
//     condition, and a prorated tire treadwear warranty. Both are ordinary
//     terms at Goodyear and Discount Tire; neither is transcribed from a
//     specific receipt.
//   - The Goodyear inspection readings are composed too, so that brake and
//     tire measurements have a second point and therefore a direction. One
//     reading is a number; two is a wear rate.
//
// Every record here is written with intake method "seed" and is reported as a
// fixture by the trust model, never counted as evidence.

export const seedVehicles: Vehicle[] = [
  {
    id: "veh-mazda3",
    year: 2016,
    make: "Mazda",
    model: "3",
    vin: "JM1BM1T7XG1284334",
    licensePlate: "WA BMG4770",
    nickname: null,
    currentMileage: 62786,
    mileageAsOf: "2026-07-15",
  },
  {
    id: "veh-outback",
    year: 2019,
    make: "Subaru",
    model: "Outback",
    vin: null,
    licensePlate: "WA CKR2215",
    nickname: "Nat's Outback",
    currentMileage: 48102,
    mileageAsOf: "2026-03-21",
  },
];

export const seedVisits: ServiceVisit[] = [
  {
    id: "vis-pepboys-2026-07",
    vehicleId: "veh-mazda3",
    provenance: { method: "seed", recordedAt: "2026-08-01T00:00:00Z", amendedAt: null, amendmentCount: 0, paymentMatched: false, hasSourceDocument: false },
    receiptThumbnail: null,
    shop: {
      name: "Pep Boys",
      storeNumber: "6449",
      address: "5601 15th Ave NW, Seattle, WA 98107",
      phone: "(206) 783-4423",
    },
    workOrderNumber: "2068633",
    dateIn: "2026-07-07",
    dateOut: "2026-07-15",
    mileage: 62786,
    serviceManager: "Jonathon Kindle",
    technicians: ["Jeffrey K"],
    lineItems: [
      { description: "Pennzoil Platinum synthetic oil change", kind: "labor", quantity: 1, unitPrice: 39.04, total: 39.04, performedBy: "Jeffrey K", partNumber: null },
      { description: "0W-20 Platinum full synthetic oil (bulk)", kind: "part", quantity: 4, unitPrice: 13.99, total: 55.96, performedBy: null, partNumber: null },
      { description: "Oil filter", kind: "part", quantity: 1, unitPrice: 9.99, total: 9.99, performedBy: null, partNumber: "PL-14459" },
      { description: "Tire rotation", kind: "labor", quantity: 1, unitPrice: 9.99, total: 9.99, performedBy: "Jeffrey K", partNumber: null },
      { description: "Reset maintenance required display", kind: "labor", quantity: 1, unitPrice: 9.99, total: 9.99, performedBy: "Jeffrey K", partNumber: null },
      { description: "Brake system inspection", kind: "labor", quantity: 1, unitPrice: 0, total: 0, performedBy: "Jeffrey K", partNumber: null },
      { description: "Complimentary vehicle inspection", kind: "labor", quantity: 1, unitPrice: 0, total: 0, performedBy: "Jeffrey K", partNumber: null },
      { description: "Shop fee", kind: "fee", quantity: 1, unitPrice: 6.59, total: 6.59, performedBy: null, partNumber: null },
    ],
    totals: { parts: 65.95, labor: 59.02, fees: 6.59, tax: 13.88, total: 145.44, paymentMethod: "Visa •••• 3911" },
    diagnostics: {
      brakeLinings: [
        { position: "front-left", value: 8, unit: "32nds" },
        { position: "front-right", value: 8, unit: "32nds" },
        { position: "rear-left", value: 6, unit: "32nds" },
        { position: "rear-right", value: 6, unit: "32nds" },
      ],
      rotorThickness: [],
      tireTreadDepths: [
        { position: "front-left", value: 6, unit: "32nds" },
        { position: "front-right", value: 6, unit: "32nds" },
        { position: "rear-left", value: 6, unit: "32nds" },
        { position: "rear-right", value: 5, unit: "32nds" },
      ],
      notes: "Customer reports squeaking during braking. Battery test requested.",
    },
    warranties: [
      {
        description: "Installed parts replaced free if they fail within 6 months or 6,000 miles",
        coverageType: "parts",
        duration: "bounded",
        months: 6,
        miles: 6000,
        prorated: false,
        proratedBasisMiles: null,
        transferable: null,
        conditions: ["Requires the original invoice"],
        appliesTo: "Installed parts (excludes filters and fluids)",
        coversLineItems: [1, 2],
      },
      {
        description: "Service and parts not covered by other warranties: 90 days or 3,000 miles",
        coverageType: "parts_and_labor",
        duration: "bounded",
        months: 3,
        miles: 3000,
        prorated: false,
        proratedBasisMiles: null,
        transferable: null,
        conditions: [],
        appliesTo: "Oil change service, tire rotation",
        coversLineItems: [0, 3],
      },
    ],
  },
  {
    id: "vis-goodyear-2025-11",
    vehicleId: "veh-mazda3",
    provenance: { method: "seed", recordedAt: "2026-08-01T00:00:00Z", amendedAt: null, amendmentCount: 0, paymentMatched: false, hasSourceDocument: false },
    receiptThumbnail: null,
    shop: {
      name: "Goodyear Auto Service",
      storeNumber: "4187",
      address: "1517 NW Market St, Seattle, WA 98107",
      phone: "(206) 782-2710",
    },
    workOrderNumber: "GY-118276",
    dateIn: "2025-11-14",
    dateOut: "2025-11-14",
    mileage: 57412,
    serviceManager: "Dana Whitfield",
    technicians: ["Marcus D"],
    lineItems: [
      { description: "Front brake pads, ceramic", kind: "part", quantity: 1, unitPrice: 89.99, total: 89.99, performedBy: null, partNumber: "WAG-ZD1521" },
      { description: "Front rotors, resurfaced", kind: "labor", quantity: 2, unitPrice: 45.0, total: 90.0, performedBy: "Marcus D", partNumber: null },
      { description: "Brake service labor", kind: "labor", quantity: 1.8, unitPrice: 129.0, total: 232.2, performedBy: "Marcus D", partNumber: null },
    ],
    totals: { parts: 89.99, labor: 322.2, fees: 0, tax: 41.94, total: 454.13, paymentMethod: "Visa •••• 3911" },
    diagnostics: {
      brakeLinings: [
        { position: "front-left", value: 10, unit: "32nds" },
        { position: "front-right", value: 10, unit: "32nds" },
        { position: "rear-left", value: 7, unit: "32nds" },
        { position: "rear-right", value: 7, unit: "32nds" },
      ],
      rotorThickness: [],
      tireTreadDepths: [
        { position: "front-left", value: 7, unit: "32nds" },
        { position: "front-right", value: 7, unit: "32nds" },
        { position: "rear-left", value: 7, unit: "32nds" },
        { position: "rear-right", value: 6, unit: "32nds" },
      ],
      notes: "Front pads replaced this visit; readings taken after installation.",
    },
    warranties: [
      {
        description: "Lifetime limited warranty on brake pads: pads replaced free for as long as the original purchaser owns the vehicle. Labor not included.",
        coverageType: "parts",
        duration: "lifetime",
        months: null,
        miles: null,
        prorated: false,
        proratedBasisMiles: null,
        transferable: false,
        conditions: ["Original purchaser only", "Requires the original invoice", "Labor charged separately on each replacement"],
        appliesTo: "Front brake pads",
        coversLineItems: [0],
      },
      {
        description: "Brake service labor covered for 12 months or 12,000 miles",
        coverageType: "labor",
        duration: "bounded",
        months: 12,
        miles: 12000,
        prorated: false,
        proratedBasisMiles: null,
        transferable: null,
        conditions: [],
        appliesTo: "Front brake service labor",
        coversLineItems: [1, 2],
      },
    ],
  },
  {
    id: "vis-mazda-dealer-2024-08",
    vehicleId: "veh-mazda3",
    provenance: { method: "seed", recordedAt: "2026-08-01T00:00:00Z", amendedAt: null, amendmentCount: 0, paymentMatched: false, hasSourceDocument: false },
    receiptThumbnail: null,
    shop: {
      name: "University Mazda",
      storeNumber: null,
      address: "4544 Roosevelt Way NE, Seattle, WA 98105",
      phone: "(206) 634-3070",
    },
    workOrderNumber: "RO-448291",
    dateIn: "2024-08-22",
    dateOut: "2024-08-22",
    mileage: 45210,
    serviceManager: null,
    technicians: ["S. Okafor"],
    lineItems: [
      { description: "45,000 mile scheduled maintenance", kind: "labor", quantity: 1, unitPrice: 289.0, total: 289.0, performedBy: "S. Okafor", partNumber: null },
      { description: "Cabin air filter", kind: "part", quantity: 1, unitPrice: 34.5, total: 34.5, performedBy: null, partNumber: null },
      { description: "Brake fluid exchange", kind: "labor", quantity: 1, unitPrice: 119.0, total: 119.0, performedBy: "S. Okafor", partNumber: null },
    ],
    totals: { parts: 34.5, labor: 408.0, fees: 12.5, tax: 46.28, total: 501.28, paymentMethod: "Amex •••• 1005" },
    diagnostics: null,
    warranties: [
      {
        description: "Genuine Mazda parts and dealer labor: 12 months or 12,000 miles",
        coverageType: "parts_and_labor",
        duration: "bounded",
        months: 12,
        miles: 12000,
        prorated: false,
        proratedBasisMiles: null,
        transferable: true,
        conditions: [],
        appliesTo: "Scheduled maintenance items",
        coversLineItems: [0, 1, 2],
      },
    ],
  },
  {
    id: "vis-discount-tire-2023-10",
    vehicleId: "veh-mazda3",
    provenance: { method: "seed", recordedAt: "2026-08-01T00:00:00Z", amendedAt: null, amendmentCount: 0, paymentMatched: false, hasSourceDocument: false },
    receiptThumbnail: null,
    shop: {
      name: "Discount Tire",
      storeNumber: "WAS 21",
      address: "12233 Aurora Ave N, Seattle, WA 98133",
      phone: "(206) 364-1955",
    },
    workOrderNumber: "1187364",
    dateIn: "2023-10-06",
    dateOut: "2023-10-06",
    mileage: 33890,
    serviceManager: null,
    technicians: [],
    lineItems: [
      { description: "Michelin Defender T+H 205/60R16", kind: "part", quantity: 4, unitPrice: 142.0, total: 568.0, performedBy: null, partNumber: "MIC-05559" },
      { description: "Installation, balancing, TPMS service", kind: "labor", quantity: 4, unitPrice: 22.0, total: 88.0, performedBy: null, partNumber: null },
      { description: "State tire fee", kind: "fee", quantity: 4, unitPrice: 1.0, total: 4.0, performedBy: null, partNumber: null },
    ],
    totals: { parts: 568.0, labor: 88.0, fees: 4.0, tax: 67.32, total: 727.32, paymentMethod: "Visa •••• 3911" },
    diagnostics: null,
    warranties: [
      {
        description: "Tread wear-out warranty, 80,000 miles from install. Credit is prorated on unused mileage against the current selling price, claimable at 2/32nds remaining.",
        coverageType: "parts",
        duration: "bounded",
        months: null,
        miles: 80000,
        prorated: true,
        proratedBasisMiles: 80000,
        transferable: null,
        conditions: ["Requires documented rotation every 5,000 to 8,000 miles", "Claimable only at 2/32nds tread remaining"],
        appliesTo: "Michelin Defender tires (4)",
        coversLineItems: [0],
      },
    ],
  },
  {
    id: "vis-subaru-dealer-2026-03",
    vehicleId: "veh-outback",
    provenance: { method: "seed", recordedAt: "2026-08-01T00:00:00Z", amendedAt: null, amendmentCount: 0, paymentMatched: false, hasSourceDocument: false },
    receiptThumbnail: null,
    shop: {
      name: "Carter Subaru Ballard",
      storeNumber: null,
      address: "5201 Leary Ave NW, Seattle, WA 98107",
      phone: "(206) 782-7475",
    },
    workOrderNumber: "RO-90417",
    dateIn: "2026-03-21",
    dateOut: "2026-03-21",
    mileage: 48102,
    serviceManager: null,
    technicians: ["T. Nguyen"],
    lineItems: [
      { description: "Full synthetic oil change", kind: "labor", quantity: 1, unitPrice: 89.95, total: 89.95, performedBy: "T. Nguyen", partNumber: null },
      { description: "Engine air filter", kind: "part", quantity: 1, unitPrice: 42.0, total: 42.0, performedBy: null, partNumber: null },
      { description: "Multi-point inspection", kind: "labor", quantity: 1, unitPrice: 0, total: 0, performedBy: "T. Nguyen", partNumber: null },
    ],
    totals: { parts: 42.0, labor: 89.95, fees: 8.0, tax: 14.42, total: 154.37, paymentMethod: "Visa •••• 8834" },
    diagnostics: {
      brakeLinings: [
        { position: "front-left", value: 7, unit: "32nds" },
        { position: "front-right", value: 7, unit: "32nds" },
        { position: "rear-left", value: 5, unit: "32nds" },
        { position: "rear-right", value: 5, unit: "32nds" },
      ],
      rotorThickness: [],
      tireTreadDepths: [
        { position: "front-left", value: 7, unit: "32nds" },
        { position: "front-right", value: 7, unit: "32nds" },
        { position: "rear-left", value: 6, unit: "32nds" },
        { position: "rear-right", value: 6, unit: "32nds" },
      ],
      notes: null,
    },
    warranties: [
      {
        description: "Dealer parts and labor: 12 months or 12,000 miles",
        coverageType: "parts_and_labor",
        duration: "bounded",
        months: 12,
        miles: 12000,
        prorated: false,
        proratedBasisMiles: null,
        transferable: true,
        conditions: [],
        appliesTo: "Oil change service, engine air filter",
        coversLineItems: [0, 1],
      },
    ],
  },
  {
    id: "vis-les-schwab-2025-10",
    vehicleId: "veh-outback",
    provenance: { method: "seed", recordedAt: "2026-08-01T00:00:00Z", amendedAt: null, amendmentCount: 0, paymentMatched: false, hasSourceDocument: false },
    receiptThumbnail: null,
    shop: {
      name: "Les Schwab Tire Center",
      storeNumber: null,
      address: "8500 15th Ave NW, Seattle, WA 98117",
      phone: "(206) 789-1102",
    },
    workOrderNumber: "LS-337120",
    dateIn: "2025-10-11",
    dateOut: "2025-10-11",
    mileage: 44870,
    serviceManager: null,
    technicians: [],
    lineItems: [
      { description: "Tire rotation and balance", kind: "labor", quantity: 1, unitPrice: 0, total: 0, performedBy: null, partNumber: null },
      { description: "Flat repair, rear-left", kind: "labor", quantity: 1, unitPrice: 0, total: 0, performedBy: null, partNumber: null },
    ],
    totals: { parts: 0, labor: 0, fees: 0, tax: 0, total: 0, paymentMethod: null },
    diagnostics: null,
    warranties: [],
  },
];

/**
 * The seed visits as extraction results, so the demo garage is written through
 * exactly the same path as a real capture. If the demo took a shortcut around
 * saveReceipt, the demo would stop being evidence that the real path works.
 */
export function seedReceipts(): ExtractedReceipt[] {
  return seedVisits.map((visit) => {
    const vehicle = seedVehicles.find((v) => v.id === visit.vehicleId)!;
    const { id: _id, vehicleId: _vid, receiptThumbnail: _thumb, provenance: _prov, ...extractedVisit } = visit;
    return {
      vehicle: {
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        vin: vehicle.vin,
        licensePlate: vehicle.licensePlate,
      },
      visit: extractedVisit,
      extractionNotes: [],
    };
  });
}
