"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/page-header";
import { ServiceEmailCard } from "@/components/service-email-card";
import { Welcome } from "@/components/welcome";
import { Odometer } from "@/components/odometer";
import { Skeleton } from "@/components/ui/skeleton";
import { getGarage, invalidateGarage, loadDemoGarage } from "@/lib/store";
import { migrateLocalRecords } from "@/lib/migrate-local";
import { buildVehicleReport } from "@/lib/vehicle-report";
import { vehicleSubtitle, vehicleTitle } from "@/lib/format";
import type { Vehicle } from "@/lib/types";

interface GarageRow {
  vehicle: Vehicle;
  activeCount: number;
  repeatCount: number;
  overdueCount: number;
  mileage: number | null;
}

export default function GaragePage() {
  const [rows, setRows] = useState<GarageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      // Runs once, before the first read, so anyone upgrading from the local
      // storage build sees their own records rather than an empty garage.
      const migration = await migrateLocalRecords();
      if (migration?.migrated) {
        invalidateGarage();
        setNotice(
          `Moved ${migration.migrated} record${migration.migrated === 1 ? "" : "s"} off this browser and into your garage.`,
        );
      }

      const { vehicles, visits } = await getGarage();
      setRows(
        vehicles.map((vehicle) => {
          const report = buildVehicleReport(
            vehicle,
            visits.filter((v) => v.vehicleId === vehicle.id),
          );
          return {
            vehicle,
            activeCount: report.activeCoverage.length,
            repeatCount: report.repeats.length,
            overdueCount: report.overdue.length,
            mileage: report.basis.miles,
          };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your garage.");
      setRows([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onLoadDemo() {
    setLoadingDemo(true);
    try {
      await loadDemoGarage();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the demo garage.");
    } finally {
      setLoadingDemo(false);
    }
  }

  return (
    <div>
      <AppHeader asHeading />
      <div className="space-y-3 px-5 pt-4">
        {rows === null ? (
          <>
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
          </>
        ) : rows.length === 0 ? (
          /* The garage is still real: nothing is seeded, and the demo stays
             opt-in and labeled. But an empty first screen was wasting the one
             moment the product gets to say what it is worth, so the pitch
             lives here until a vehicle exists. */
          <Welcome onLoadDemo={onLoadDemo} loadingDemo={loadingDemo} />
        ) : (
          rows.map(({ vehicle, activeCount, repeatCount, overdueCount, mileage }) => (
            <Link
              key={vehicle.id}
              href={`/vehicles/${vehicle.id}`}
              className="block rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-foreground/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold leading-tight">{vehicleTitle(vehicle)}</p>
                  {vehicleSubtitle(vehicle) && (
                    <p className="text-sm text-muted-foreground">{vehicleSubtitle(vehicle)}</p>
                  )}
                </div>
                <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
              </div>

              <div className="mt-3">
                <Odometer miles={mileage} />
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {repeatCount > 0 && (
                  <span className="flex items-center gap-1 font-medium text-amber-700">
                    <AlertTriangle className="size-3.5" />
                    {repeatCount} possible repeat charge{repeatCount === 1 ? "" : "s"}
                  </span>
                )}
                {activeCount > 0 && (
                  <span className="flex items-center gap-1 text-covered">
                    <ShieldCheck className="size-3.5" />
                    {activeCount} coverage item{activeCount === 1 ? "" : "s"} standing
                  </span>
                )}
                {overdueCount > 0 && <span className="text-muted-foreground">{overdueCount} due or overdue</span>}
              </div>
            </Link>
          ))
        )}

        {rows !== null && <ServiceEmailCard />}

        {notice && (
          <p role="status" className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
