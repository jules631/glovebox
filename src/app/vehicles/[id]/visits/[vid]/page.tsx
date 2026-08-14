"use client";

import { use, useEffect, useState } from "react";
import { MapPin, Phone, ShieldCheck, ShieldX, Wrench } from "lucide-react";
import { BackHeader } from "@/components/page-header";
import { CornerReadout } from "@/components/corner-readout";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getGarage } from "@/lib/store";
import { buildVehicleReport } from "@/lib/vehicle-report";
import type { WarrantyStatus } from "@/lib/warranty";
import { visitTrust, type VisitTrust } from "@/lib/provenance";
import { ClaimPacketCard } from "@/components/health-panels";
import { fmtDate, fmtMiles, fmtUSD } from "@/lib/format";
import type { ServiceVisit } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_LABEL = { part: "Part", labor: "Labor", fee: "Fee", other: "" } as const;

export default function VisitPage({ params }: { params: Promise<{ id: string; vid: string }> }) {
  const { id, vid } = use(params);
  const [visit, setVisit] = useState<ServiceVisit | null>(null);
  const [statuses, setStatuses] = useState<WarrantyStatus[]>([]);
  const [trust, setTrust] = useState<VisitTrust | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const { vehicles, visits } = await getGarage();
      const v = visits.find((x) => x.id === vid) ?? null;
      setVisit(v);
      const vehicle = vehicles.find((x) => x.id === id);
      if (v && vehicle) {
        const report = buildVehicleReport(vehicle, visits.filter((x) => x.vehicleId === id));
        setStatuses(report.coverage.filter((s) => s.visit.id === vid));
        setTrust(visitTrust(v));
      }
      setLoaded(true);
    }
    void load();
  }, [id, vid]);

  if (!loaded) {
    return (
      <div>
        <BackHeader href={`/vehicles/${id}`} label="History" />
        <div className="space-y-3 px-5 pt-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div>
        <BackHeader href={`/vehicles/${id}`} label="History" />
        <p className="px-5 pt-8 text-sm text-muted-foreground">This visit record wasn&apos;t found.</p>
      </div>
    );
  }

  return (
    <div>
      <BackHeader href={`/vehicles/${id}`} label="History" />
      <div className="px-5 pb-8">
        {/* Visit header */}
        <h1 className="font-display text-2xl font-bold uppercase leading-tight tracking-wide">
          {visit.shop.name}
          {visit.shop.storeNumber ? ` #${visit.shop.storeNumber}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {fmtDate(visit.dateIn)}
          {visit.dateOut && visit.dateOut !== visit.dateIn ? ` – ${fmtDate(visit.dateOut)}` : ""}
          {visit.mileage != null ? ` · ${fmtMiles(visit.mileage)}` : ""}
        </p>
        {visit.workOrderNumber && (
          <p className="mt-1 font-mono text-[11px] tracking-wide text-muted-foreground">
            Work order {visit.workOrderNumber}
          </p>
        )}

        {/* Who worked on it */}
        {(visit.technicians.length > 0 || visit.serviceManager) && (
          <div className="mt-4 rounded-lg bg-accent px-4 py-3">
            <div className="flex items-center gap-2 text-accent-foreground">
              <Wrench className="size-4 shrink-0" />
              <p className="text-sm">
                {visit.technicians.length > 0 && (
                  <>
                    Serviced by <span className="font-semibold">{visit.technicians.join(", ")}</span>
                  </>
                )}
                {visit.technicians.length > 0 && visit.serviceManager && " · "}
                {visit.serviceManager && <>Manager: {visit.serviceManager}</>}
              </p>
            </div>
          </div>
        )}

        {/* Line items, receipt style */}
        <section className="mt-5 rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Work performed
          </h2>
          <ul className="mt-2 divide-y divide-dashed divide-border">
            {visit.lineItems.map((li, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{li.description}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {[
                      KIND_LABEL[li.kind],
                      li.quantity != null && li.quantity !== 1 ? `× ${li.quantity}` : null,
                      li.performedBy,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm tabular-nums">
                  {li.total === 0 ? "Free" : fmtUSD(li.total)}
                </p>
              </li>
            ))}
          </ul>
          <Separator className="my-2" />
          <dl className="space-y-1 text-sm">
            {(
              [
                ["Parts", visit.totals.parts],
                ["Labor", visit.totals.labor],
                ["Fees", visit.totals.fees],
                ["Tax", visit.totals.tax],
              ] as const
            ).map(
              ([label, value]) =>
                value != null &&
                value > 0 && (
                  <div key={label} className="flex justify-between text-muted-foreground">
                    <dt>{label}</dt>
                    <dd className="font-mono tabular-nums">{fmtUSD(value)}</dd>
                  </div>
                ),
            )}
            <div className="flex justify-between pt-1 font-semibold">
              <dt>Total</dt>
              <dd className="font-mono tabular-nums">{fmtUSD(visit.totals.total)}</dd>
            </div>
            {visit.totals.paymentMethod && (
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <dt>Paid with</dt>
                <dd>{visit.totals.paymentMethod}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Coverage recorded on this visit */}
        {statuses.length > 0 && (
          <section className="mt-5">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Warranty coverage
            </h2>
            <ul className="mt-2 space-y-2">
              {statuses.map((s, i) => (
                <li
                  key={i}
                  className={cn(
                    "rounded-lg border p-3",
                    s.state === "active"
                      ? "border-covered/40 bg-covered/5"
                      : s.state === "not_computable"
                        ? "border-dashed border-border bg-card"
                        : "border-border bg-card",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {s.state === "expired" ? (
                      <ShieldX className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-covered" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">{s.term.appliesTo ?? s.term.description}</p>
                      <p className="mt-0.5 text-xs italic leading-snug text-muted-foreground">
                        &ldquo;{s.term.description}&rdquo;
                      </p>
                      {/* The explanation, not a verdict. */}
                      <p
                        className={cn(
                          "mt-1 text-xs font-medium",
                          s.state === "expired" ? "text-muted-foreground" : "text-covered",
                        )}
                      >
                        {s.explanation}
                      </p>
                      {s.conditions.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {s.conditions.map((c, ci) => (
                            <li key={ci} className="text-[11px] leading-snug text-muted-foreground">
                              · {c}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  {s.state !== "expired" && (
                    <div className="mt-3">
                      <ClaimPacketCard packet={s.claim} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Where this record came from. A buyer cannot evaluate a claim, but
            they can evaluate its provenance, so it is stated on the record
            itself rather than only in aggregate. */}
        {trust && (
          <section className="mt-5 rounded-lg border border-border bg-card p-3.5">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Where this came from
            </h2>
            <p className="mt-2 text-sm font-medium">{trust.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Recorded {trust.ageDays} days ago{trust.amended ? " · amended since" : ""}
            </p>
            <ul className="mt-2 space-y-1">
              {trust.verifiableBy.map((v, i) => (
                <li key={i} className="text-xs leading-snug text-muted-foreground">
                  · {v}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Diagnostics */}
        {visit.diagnostics && (
          <section className="mt-5 rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Inspection readings
            </h2>
            <div className="mt-3 space-y-4">
              <CornerReadout title="Brake linings" measurements={visit.diagnostics.brakeLinings} />
              <CornerReadout title="Tire tread depth" measurements={visit.diagnostics.tireTreadDepths} />
              <CornerReadout title="Rotor thickness" measurements={visit.diagnostics.rotorThickness} />
              {visit.diagnostics.notes && (
                <p className="border-t border-dashed border-border pt-3 text-xs text-muted-foreground">
                  {visit.diagnostics.notes}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Shop info */}
        <section className="mt-5 text-xs text-muted-foreground">
          {visit.shop.address && (
            <p className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {visit.shop.address}
            </p>
          )}
          {visit.shop.phone && (
            <p className="mt-1 flex items-center gap-1.5">
              <Phone className="size-3.5" />
              {visit.shop.phone}
            </p>
          )}
        </section>

        {/* Receipt thumbnail */}
        {visit.receiptThumbnail && (
          <section className="mt-5">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Original receipt
            </h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={visit.receiptThumbnail}
              alt="Scanned receipt"
              className="mt-2 w-full rounded-lg border border-border"
            />
          </section>
        )}
      </div>
    </div>
  );
}
