// One time migration out of localStorage.
//
// Earlier builds kept the whole garage under a single localStorage key. Moving
// to Postgres without this would strand every record anyone had already
// captured, in a product whose entire pitch is that your history should outlive
// any one shop, phone, or browser. Losing it on our own upgrade would be the
// joke telling itself.
//
// Two honesty constraints:
//
//   - Migrated records get a NEW recorded_at, because the server assigns it and
//     we genuinely cannot verify when a client side record was written. Rather
//     than let that quietly inflate their apparent age, each one carries a note
//     saying it was migrated. Trust that comes from a timestamp we cannot check
//     is not trust.
//
//   - The old key is renamed, not deleted. If a migration goes wrong the
//     original data is still sitting there.

import type { ExtractedReceipt, LineItem, WarrantyTerm } from "./types";
import { saveExtractedReceipt } from "./store";

const OLD_KEY = "glovebox.v1";
const ARCHIVED_KEY = "glovebox.v1.migrated";

/** The pre-migration shapes, which had fewer fields than today's. */
interface LegacyWarranty {
  description: string;
  coverageType: WarrantyTerm["coverageType"];
  months: number | null;
  miles: number | null;
  appliesTo: string | null;
}
interface LegacyVisit {
  id: string;
  vehicleId: string;
  source?: string;
  receiptThumbnail?: string | null;
  lineItems: Array<Omit<LineItem, "partNumber"> & { partNumber?: string | null }>;
  warranties: LegacyWarranty[];
  [key: string]: unknown;
}
interface LegacyVehicle {
  id: string;
  year: number | null;
  make: string;
  model: string;
  vin: string | null;
  licensePlate: string | null;
}
interface LegacyDb {
  vehicles?: LegacyVehicle[];
  visits?: LegacyVisit[];
}

/**
 * Bring an old warranty term up to the current shape.
 *
 * Everything the old model could not express defaults to the reading that
 * claims the least: no proration, no conditions, and coverage treated as
 * bounded only where a bound was actually recorded. Inventing a lifetime term
 * here would fabricate coverage nobody wrote down.
 */
function upgradeWarranty(w: LegacyWarranty): WarrantyTerm {
  return {
    description: w.description,
    coverageType: w.coverageType,
    duration: w.months != null || w.miles != null ? "bounded" : "unstated",
    months: w.months,
    miles: w.miles,
    prorated: false,
    proratedBasisMiles: null,
    transferable: null,
    conditions: [],
    appliesTo: w.appliesTo,
    coversLineItems: [],
  };
}

export interface MigrationResult {
  migrated: number;
  skipped: number;
  failed: number;
}

export async function migrateLocalRecords(): Promise<MigrationResult | null> {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(OLD_KEY);
  if (!raw) return null;

  let db: LegacyDb;
  try {
    db = JSON.parse(raw) as LegacyDb;
  } catch {
    // Unreadable rather than absent. Leave it alone for a human to look at.
    return null;
  }

  const vehicles = db.vehicles ?? [];
  const visits = db.visits ?? [];
  const result: MigrationResult = { migrated: 0, skipped: 0, failed: 0 };

  for (const visit of visits) {
    // Demo fixtures were never the user's data and should not be resurrected
    // as though they were.
    if (visit.source === "seed") {
      result.skipped++;
      continue;
    }

    const vehicle = vehicles.find((v) => v.id === visit.vehicleId);
    if (!vehicle) {
      result.skipped++;
      continue;
    }

    const { id: _id, vehicleId: _vid, source: _src, receiptThumbnail, lineItems, warranties, ...rest } = visit;

    const receipt = {
      vehicle: {
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        vin: vehicle.vin,
        licensePlate: vehicle.licensePlate,
      },
      visit: {
        ...rest,
        lineItems: lineItems.map((li) => ({ ...li, partNumber: li.partNumber ?? null })),
        warranties: warranties.map(upgradeWarranty),
      },
      extractionNotes: [
        "Migrated from this browser's local storage. The recorded date is the migration date, not when it was first captured.",
      ],
    } as ExtractedReceipt;

    try {
      await saveExtractedReceipt(receipt, {
        // The old store had no provenance, so the most it can honestly claim is
        // that a person put it there.
        intakeMethod: "owner_entry",
        receiptThumbnail: receiptThumbnail ?? null,
      });
      result.migrated++;
    } catch {
      result.failed++;
    }
  }

  // Only retire the old key once nothing failed, so a partial migration can be
  // retried rather than half lost.
  if (result.failed === 0) {
    window.localStorage.setItem(ARCHIVED_KEY, raw);
    window.localStorage.removeItem(OLD_KEY);
  }

  return result;
}
