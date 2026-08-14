// VIN identity and the coverage that exists without any receipt.
//
// Every other module here reasons from documents the owner captured. This one
// reasons from the car itself. It matters for two reasons:
//
//   1. Day one. A new owner has no receipts. A VIN alone yields the year, make,
//      model, engine, and every open recall, so the app is useful before the
//      user has done any work at all. That is the cold start fix.
//
//   2. Recalls and factory coverage are the largest coverage a car carries and
//      they appear on no service receipt, because they are keyed to the vehicle
//      rather than to a visit. A product that only reads receipts is
//      structurally blind to them.
//
// NHTSA vPIC and the recalls API are public, free, and need no key.

export interface VinDecode {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  bodyClass: string | null;
  engine: string | null;
  driveType: string | null;
  fuelType: string | null;
  plantCountry: string | null;
  /** vPIC returns its own complaint about a malformed VIN; surface it rather
   *  than silently producing a half decoded vehicle. */
  errorText: string | null;
}

export interface Recall {
  campaignNumber: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
  reportedOn: string | null;
}

const VPIC = "https://vpic.nhtsa.dot.gov/api/vehicles";
const RECALLS = "https://api.nhtsa.gov/recalls/recallsByVehicle";

/** A VIN is 17 characters and never uses I, O, or Q. */
export function isPlausibleVin(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin.trim());
}

function str(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

export async function decodeVin(vin: string): Promise<VinDecode> {
  const clean = vin.trim().toUpperCase();
  const res = await fetch(`${VPIC}/DecodeVinValues/${encodeURIComponent(clean)}?format=json`, {
    // The decode for a given VIN never changes, so cache it hard.
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  if (!res.ok) throw new Error(`vPIC returned ${res.status}`);

  const json = (await res.json()) as { Results?: Array<Record<string, unknown>> };
  const r = json.Results?.[0] ?? {};

  const displacement = str(r.DisplacementL);
  const cylinders = str(r.EngineCylinders);
  const engine = [displacement ? `${Number(displacement).toFixed(1)}L` : null, cylinders ? `${cylinders} cyl` : null]
    .filter(Boolean)
    .join(" ");

  return {
    vin: clean,
    year: str(r.ModelYear) ? Number(str(r.ModelYear)) : null,
    make: str(r.Make),
    model: str(r.Model),
    trim: str(r.Trim),
    bodyClass: str(r.BodyClass),
    engine: engine.length ? engine : null,
    driveType: str(r.DriveType),
    fuelType: str(r.FuelTypePrimary),
    plantCountry: str(r.PlantCountry),
    errorText: str(r.ErrorText) === "0 - VIN decoded clean. Check Digit (9th position) is correct" ? null : str(r.ErrorText),
  };
}

/**
 * Open recalls. Keyed to make, model, and year rather than to the VIN, which is
 * how NHTSA publishes them. Recalls have no time or mileage limit and are
 * always free, which makes them the only coverage in this whole product that
 * needs no fine print at all.
 */
export async function openRecalls(make: string, model: string, year: number): Promise<Recall[]> {
  const url = `${RECALLS}?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
  if (!res.ok) throw new Error(`NHTSA recalls returned ${res.status}`);

  const json = (await res.json()) as { results?: Array<Record<string, unknown>> };
  return (json.results ?? []).map((r) => ({
    campaignNumber: str(r.NHTSACampaignNumber) ?? "unknown",
    component: str(r.Component) ?? "Unspecified",
    summary: str(r.Summary) ?? "",
    consequence: str(r.Consequence) ?? "",
    remedy: str(r.Remedy) ?? "",
    reportedOn: str(r.ReportReceivedDate),
  }));
}
