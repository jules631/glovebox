import { z } from "zod";

// Zod schemas are the source of truth. The same ExtractedReceiptSchema drives
// Claude's structured output on the server and form validation on the client.
// Almost everything is nullable: receipt formats vary wildly across shops and
// the extractor is instructed to return null rather than invent a value.

export const MeasurementSchema = z.object({
  position: z.string().describe('Corner or location, e.g. "front-left", "rear-right"'),
  value: z.number(),
  unit: z.string().describe('e.g. "32nds", "mm", "in"'),
});

export const DiagnosticsSchema = z.object({
  brakeLinings: z.array(MeasurementSchema),
  rotorThickness: z.array(MeasurementSchema),
  tireTreadDepths: z.array(MeasurementSchema),
  notes: z.string().nullable(),
});

export const LineItemSchema = z.object({
  description: z.string(),
  kind: z.enum(["part", "labor", "fee", "other"]),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  total: z.number().nullable(),
  performedBy: z.string().nullable().describe("Technician who performed this line, if listed"),
  partNumber: z.string().nullable().describe("Manufacturer or shop part number, when printed"),
});

export const TotalsSchema = z.object({
  parts: z.number().nullable(),
  labor: z.number().nullable(),
  fees: z.number().nullable(),
  tax: z.number().nullable(),
  total: z.number().nullable(),
  paymentMethod: z.string().nullable().describe('e.g. "Visa •••• 3911"'),
});

// Real warranties are not just "months or miles". A lifetime brake pad warranty
// has no bounds at all, a tire warranty pays a prorated share of what you paid,
// and most chain warranties die the moment you sell the car. A model that can
// only express bounded terms silently drops the most valuable coverage a driver
// has, so the shape below carries duration, proration, and conditions
// separately, and every one of them stays faithful to the printed language.
export const WarrantyTermSchema = z.object({
  description: z.string().describe("The warranty language, condensed but faithful to the receipt"),
  coverageType: z.enum(["parts", "labor", "parts_and_labor", "unknown"]),
  duration: z
    .enum(["bounded", "lifetime", "unstated"])
    .describe(
      'How long coverage runs. "bounded" when months or miles are printed, "lifetime" for lifetime or "as long as you own the vehicle" language, "unstated" when the receipt promises coverage without saying how long',
    ),
  months: z.number().nullable(),
  miles: z.number().nullable(),
  prorated: z
    .boolean()
    .describe("True when the payout shrinks with use, as on tire treadwear and battery warranties"),
  proratedBasisMiles: z
    .number()
    .nullable()
    .describe("For prorated mileage warranties, the full warranted mileage, e.g. 60000 on a 60,000 mile tire"),
  transferable: z.boolean().nullable().describe("Whether coverage survives a sale, when the receipt says"),
  conditions: z
    .array(z.string())
    .describe(
      'Any condition the receipt attaches to the coverage, e.g. "original purchaser only", "requires original invoice", "requires documented rotation every 5,000 miles"',
    ),
  appliesTo: z.string().nullable().describe('What is covered, e.g. "Installed parts", "Brake service labor"'),
  coversLineItems: z
    .array(z.number())
    .describe("Indexes into lineItems that this term covers. Empty when the receipt does not say."),
});

export const ShopSchema = z.object({
  name: z.string(),
  storeNumber: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
});

export const ExtractedVehicleSchema = z.object({
  year: z.number().nullable(),
  make: z.string(),
  model: z.string(),
  vin: z.string().nullable(),
  licensePlate: z.string().nullable(),
});

export const ExtractedVisitSchema = z.object({
  shop: ShopSchema,
  workOrderNumber: z.string().nullable(),
  dateIn: z.string().nullable().describe("ISO date, e.g. 2026-07-07"),
  dateOut: z.string().nullable().describe("ISO date the work was completed or picked up"),
  mileage: z.number().nullable().describe("Odometer reading at service"),
  serviceManager: z.string().nullable(),
  technicians: z.array(z.string()),
  lineItems: z.array(LineItemSchema),
  totals: TotalsSchema,
  diagnostics: DiagnosticsSchema.nullable(),
  warranties: z.array(WarrantyTermSchema),
});

export const ExtractedReceiptSchema = z.object({
  vehicle: ExtractedVehicleSchema,
  visit: ExtractedVisitSchema,
  extractionNotes: z
    .array(z.string())
    .describe("Ambiguities or judgment calls made during extraction, for the human reviewing"),
});

export type Measurement = z.infer<typeof MeasurementSchema>;
export type Diagnostics = z.infer<typeof DiagnosticsSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type Totals = z.infer<typeof TotalsSchema>;
export type WarrantyTerm = z.infer<typeof WarrantyTermSchema>;
export type Shop = z.infer<typeof ShopSchema>;
export type ExtractedVehicle = z.infer<typeof ExtractedVehicleSchema>;
export type ExtractedVisit = z.infer<typeof ExtractedVisitSchema>;
export type ExtractedReceipt = z.infer<typeof ExtractedReceiptSchema>;

// Stored shapes (client side only, never sent to the API)

export interface Vehicle extends ExtractedVehicle {
  id: string;
  nickname: string | null;
  // Odometer freshness: warranty math is only as good as the last known reading.
  currentMileage: number | null;
  mileageAsOf: string | null; // ISO date
}

// How a record got here. This is the spine of the trust model: a buyer cannot
// evaluate a claim, but they can evaluate where it came from.
export type IntakeMethod =
  /** An invoice the shop itself sent, forwarded or pasted with headers intact. */
  | "shop_email"
  /** A PDF invoice from the shop. */
  | "pdf"
  /** A photograph of paper. */
  | "photo"
  /** Typed by the owner, including DIY work no shop ever recorded. */
  | "owner_entry"
  /** Demo fixture. Never counted as evidence. */
  | "seed";

export interface Provenance {
  method: IntakeMethod;
  /** Server assigned, never client supplied. A record's age is the single
   *  strongest signal it has: a history maintained since 2021 is credible in a
   *  way that one created the week the car was listed is not. */
  recordedAt: string;
  /** Records are append only. An edit becomes an amendment with its own
   *  timestamp, so a seller can add to a history but never quietly rewrite it. */
  amendedAt: string | null;
  amendmentCount: number;
  /** A card or bank transaction matching this shop, amount, and date. An
   *  independent second source is what lifts a photograph from a claim to
   *  corroborated evidence. */
  paymentMatched: boolean;
  /** Whether the source document is still held and can be shown. */
  hasSourceDocument: boolean;
}

export interface ServiceVisit extends ExtractedVisit {
  id: string;
  vehicleId: string;
  receiptThumbnail: string | null; // small dataURL; originals are never stored
  provenance: Provenance;
}
