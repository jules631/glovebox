"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ScanLine, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/page-header";
import { Odometer } from "@/components/odometer";
import { Skeleton } from "@/components/ui/skeleton";
import { getVehicles, getVisits } from "@/lib/store";
import { activeWarranties, latestKnownMileage } from "@/lib/warranty";
import { fmtDate, vehicleSubtitle, vehicleTitle } from "@/lib/format";
import type { ServiceVisit, Vehicle } from "@/lib/types";

interface GarageRow {
  vehicle: Vehicle;
  visits: ServiceVisit[];
  activeCount: number;
  mileage: number | null;
}

export default function GaragePage() {
  const [rows, setRows] = useState<GarageRow[] | null>(null);

  useEffect(() => {
    const vehicles = getVehicles();
    setRows(
      vehicles.map((vehicle) => {
        const visits = getVisits(vehicle.id);
        return {
          vehicle,
          visits,
          activeCount: activeWarranties(vehicle, visits).length,
          mileage: latestKnownMileage(vehicle, visits),
        };
      }),
    );
  }, []);

  return (
    <div>
      <AppHeader />
      <div className="space-y-3 px-5 pt-4">
        {rows === null ? (
          <>
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
          </>
        ) : (
          rows.map(({ vehicle, visits, activeCount, mileage }) => (
            <Link
              key={vehicle.id}
              href={`/vehicles/${vehicle.id}`}
              className="block rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-2xl font-semibold uppercase leading-none tracking-wide">
                    {vehicleTitle(vehicle)}
                  </p>
                  {vehicleSubtitle(vehicle) && (
                    <p className="mt-1 text-sm text-muted-foreground">{vehicleSubtitle(vehicle)}</p>
                  )}
                </div>
                <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
              </div>
              <div className="mt-3">
                <Odometer miles={mileage} />
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {visits.length} {visits.length === 1 ? "visit" : "visits"}
                  {visits[0]?.dateIn ? ` · last ${fmtDate(visits[0].dateIn)}` : ""}
                </span>
                {activeCount > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 font-medium text-covered">
                    <ShieldCheck className="size-3.5" />
                    {activeCount} covered
                  </span>
                )}
              </div>
            </Link>
          ))
        )}

        <Link
          href="/capture"
          className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <ScanLine className="size-4" />
          Scan a receipt to add a service record
        </Link>
      </div>
    </div>
  );
}
