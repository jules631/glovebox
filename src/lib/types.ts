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
});

export const TotalsSchema = z.object({
  parts: z.number().nullable(),
  labor: z.number().nullable(),
  fees: z.number().nullable(),
  tax: z.number().nullable(),
  total: z.number().nullable(),
  paymentMethod: z.string().nullable().describe('e.g. "Visa •••• 3911"'),
});

export const WarrantyTermSchema = z.object({
  description: z.string().describe("The warranty language, condensed but faithful to the receipt"),
  coverageType: z.enum(["parts", "labor", "parts_and_labor", "unknown"]),
  months: z.number().nullable(),
  miles: z.number().nullable(),
  appliesTo: z.string().nullable().describe('What is covered, e.g. "Installed parts", "Brake service labor"'),
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

export interface ServiceVisit extends ExtractedVisit {
  id: string;
  vehicleId: string;
  receiptThumbnail: string | null; // small dataURL; originals are never stored
  source: "extracted" | "seed";
}
