"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { BackHeader } from "@/components/page-header";
import { Odometer } from "@/components/odometer";
import { VisitCard } from "@/components/visit-card";
import { WarrantySticker } from "@/components/warranty-sticker";
import { ClaimPacketCard, DueList, MileagePanel, RepeatAlerts, TrustPanel, WearTrends } from "@/components/health-panels";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getGarage, setVehicleMileage } from "@/lib/store";
import { buildVehicleReport, type VehicleReport } from "@/lib/vehicle-report";
import { vehicleSubtitle, vehicleTitle } from "@/lib/format";

export default function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [report, setReport] = useState<VehicleReport | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mileageDraft, setMileageDraft] = useState("");
  const [mileageOpen, setMileageOpen] = useState(false);
  const [showAllCoverage, setShowAllCoverage] = useState(false);

  const reload = useCallback(async () => {
    const { vehicles, visits } = await getGarage();
    const vehicle = vehicles.find((v) => v.id === id);
    setReport(vehicle ? buildVehicleReport(vehicle, visits.filter((v) => v.vehicleId === id)) : null);
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loaded && !report) {
    return (
      <div>
        <BackHeader href="/" label="Garage" />
        <p className="px-5 pt-6 text-sm text-muted-foreground">That vehicle is not in this garage.</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div>
        <BackHeader href="/" label="Garage" />
        <div className="space-y-3 px-5 pt-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  const { vehicle, visits, basis, activeCoverage, coverage, overdue, wear, repeats, trust, completeness, mileage } = report;
  const shownCoverage = showAllCoverage ? coverage : activeCoverage;

  async function saveMileage() {
    const parsed = Number(mileageDraft.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    await setVehicleMileage(id, parsed);
    setMileageOpen(false);
    setMileageDraft("");
    await reload();
  }

  return (
    <div className="pb-8">
      <BackHeader href="/" label="Garage" />

      <div className="space-y-6 px-5 pt-4">
        <header>
          <h1 className="font-display text-2xl font-semibold leading-tight">{vehicleTitle(vehicle)}</h1>
          {vehicleSubtitle(vehicle) && <p className="text-sm text-muted-foreground">{vehicleSubtitle(vehicle)}</p>}
          {vehicle.vin && <p className="mt-0.5 font-mono text-xs text-muted-foreground">VIN {vehicle.vin}</p>}

          <div className="mt-3 flex items-center gap-3">
            <Odometer miles={basis.miles} />
            <Button variant="ghost" size="sm" onClick={() => setMileageOpen(true)}>
              <Pencil className="size-3.5" />
              Update
            </Button>
            <Dialog open={mileageOpen} onOpenChange={setMileageOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Current odometer</DialogTitle>
                  <DialogDescription>
                    Everything that depends on mileage, coverage limits and service intervals alike, is only as current
                    as this number.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  inputMode="numeric"
                  placeholder="62786"
                  value={mileageDraft}
                  onChange={(e) => setMileageDraft(e.target.value)}
                />
                <DialogFooter>
                  <Button onClick={saveMileage}>Save reading</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {basis.isProjected && (
            <p className="mt-1 text-xs text-muted-foreground">
              Estimated from your driving. Last actual reading was {basis.daysStale} days ago.
            </p>
          )}
        </header>

        {/* Money first. Everything below this is context for it. */}
        <RepeatAlerts repeats={repeats} />

        {shownCoverage.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Coverage
              </h2>
              {coverage.length > activeCoverage.length && (
                <button
                  className="text-xs text-muted-foreground underline underline-offset-2"
                  onClick={() => setShowAllCoverage((v) => !v)}
                >
                  {showAllCoverage ? "Hide expired" : `Show all ${coverage.length}`}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {shownCoverage.map((status, i) => (
                <div key={i} className="space-y-2">
                  <WarrantySticker status={status} />
                  {status.state !== "expired" && <ClaimPacketCard packet={status.claim} />}
                </div>
              ))}
            </div>
          </section>
        )}

        <DueList items={overdue.length ? overdue : report.schedule.slice(0, 6)} />
        <WearTrends series={wear} />
        <MileagePanel analysis={mileage} />
        <TrustPanel trust={trust} completeness={completeness} />

        <section className="space-y-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Service history
          </h2>
          {visits.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No visits recorded yet.
            </p>
          ) : (
            <div className="space-y-2">
              {visits.map((visit) => (
                <VisitCard
                  key={visit.id}
                  visit={visit}
                  activeWarrantyCount={activeCoverage.filter((c) => c.visit.id === visit.id).length}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
