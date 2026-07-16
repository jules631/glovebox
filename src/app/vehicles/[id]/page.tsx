"use client";

import { use, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { BackHeader } from "@/components/page-header";
import { Odometer } from "@/components/odometer";
import { VisitCard } from "@/components/visit-card";
import { WarrantySticker } from "@/components/warranty-sticker";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getVehicle, getVisits, setVehicleMileage } from "@/lib/store";
import { warrantyStatuses, type WarrantyStatus } from "@/lib/warranty";
import { fmtDate, vehicleSubtitle, vehicleTitle } from "@/lib/format";
import type { ServiceVisit, Vehicle } from "@/lib/types";

export default function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [visits, setVisits] = useState<ServiceVisit[]>([]);
  const [statuses, setStatuses] = useState<WarrantyStatus[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mileageDraft, setMileageDraft] = useState("");
  const [mileageOpen, setMileageOpen] = useState(false);
  const [showAllCoverage, setShowAllCoverage] = useState(false);

  function reload() {
    const v = getVehicle(id);
    const vis = getVisits(id);
    setVehicle(v ?? null);
    setVisits(vis);
    setStatuses(v ? warrantyStatuses(v, vis) : []);
    setLoaded(true);
  }

  useEffect(reload, [id]);

  if (loaded && !vehicle) {
    return (
      <div>
        <BackHeader href="/" label="Garage" />
        <p className="px-5 pt-8 text-sm text-muted-foreground">
          This vehicle isn&apos;t in your garage. Head back and pick one, or scan a receipt to add it.
        </p>
      </div>
    );
  }

  // Soonest-expiring coverage first; the two most urgent get the full sticker
  // treatment, the rest collapse so history stays above the fold.
  const active = statuses
    .filter((s) => s.isActive)
    .sort((a, b) => (a.expiresDate ?? "9999").localeCompare(b.expiresDate ?? "9999"));
  const shownStickers = showAllCoverage ? active : active.slice(0, 2);
  const activeCountByVisit = new Map<string, number>();
  for (const s of active) {
    activeCountByVisit.set(s.visit.id, (activeCountByVisit.get(s.visit.id) ?? 0) + 1);
  }

  return (
    <div>
      <BackHeader href="/" label="Garage" />
      {!vehicle ? (
        <div className="space-y-3 px-5 pt-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      ) : (
        <div className="px-5">
          <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-wide">
            {vehicleTitle(vehicle)}
          </h1>
          {vehicleSubtitle(vehicle) && (
            <p className="mt-1 text-sm text-muted-foreground">{vehicleSubtitle(vehicle)}</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <Odometer miles={vehicle.currentMileage} />
            <Dialog open={mileageOpen} onOpenChange={setMileageOpen}>
              <DialogTrigger
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setMileageDraft(vehicle.currentMileage?.toString() ?? "")}
              >
                <Pencil className="size-3" />
                Update
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Update odometer</DialogTitle>
                  <DialogDescription>
                    Warranty checks are based on your last known reading
                    {vehicle.mileageAsOf ? ` from ${fmtDate(vehicle.mileageAsOf)}` : ""}. Enter what the
                    dash shows now.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  inputMode="numeric"
                  value={mileageDraft}
                  onChange={(e) => setMileageDraft(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="62786"
                  className="font-mono"
                />
                <DialogFooter>
                  <Button
                    onClick={() => {
                      const miles = parseInt(mileageDraft, 10);
                      if (!Number.isNaN(miles)) {
                        setVehicleMileage(vehicle.id, miles);
                        reload();
                      }
                      setMileageOpen(false);
                    }}
                  >
                    Save reading
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {vehicle.vin && (
            <p className="mt-2 font-mono text-[11px] tracking-wide text-muted-foreground">
              VIN {vehicle.vin}
            </p>
          )}

          {active.length > 0 && (
            <div className="mt-5 space-y-3">
              {shownStickers.map((s, i) => (
                <WarrantySticker key={`${s.visit.id}-${i}`} status={s} />
              ))}
              {active.length > 2 && (
                <button
                  type="button"
                  onClick={() => setShowAllCoverage((v) => !v)}
                  className="w-full rounded-lg border border-dashed border-covered/50 py-2 text-xs font-semibold uppercase tracking-wider text-covered transition-colors hover:bg-covered/5"
                >
                  {showAllCoverage ? "Show less" : `${active.length - 2} more covered items`}
                </button>
              )}
              <MileageBasisNote active={active} />
            </div>
          )}

          <h2 className="mt-7 font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Service history
          </h2>
          <div className="mt-2 space-y-3 pb-8">
            {visits.length === 0 ? (
              <p className="rounded-lg border-2 border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                No visits recorded yet. Scan a receipt to start this vehicle&apos;s history.
              </p>
            ) : (
              visits.map((visit) => (
                <VisitCard
                  key={visit.id}
                  visit={visit}
                  activeWarrantyCount={activeCountByVisit.get(visit.id) ?? 0}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MileageBasisNote({ active }: { active: WarrantyStatus[] }) {
  const basis = active[0]?.mileageBasis;
  if (basis == null) return null;
  return (
    <p className="text-[11px] text-muted-foreground">
      Mileage checks based on your last recorded odometer: {basis.toLocaleString("en-US")} mi
    </p>
  );
}
