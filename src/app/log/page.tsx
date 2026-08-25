"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BackHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getVehicles, saveExtractedReceipt } from "@/lib/store";
import { SERVICES, type ServiceKey } from "@/lib/taxonomy";
import { vehicleTitle } from "@/lib/format";
import type { Vehicle } from "@/lib/types";

// The work people actually do themselves, rather than all forty services.
const DIY_SERVICES: ServiceKey[] = [
  "oil_change",
  "engine_air_filter",
  "cabin_air_filter",
  "wiper_blades",
  "battery",
  "brake_pads",
  "spark_plugs",
  "tire_rotation",
  "coolant_flush",
  "serpentine_belt",
  "headlight",
  "other",
];

/**
 * DIY entry.
 *
 * Work you did yourself is invisible to every reporting system in the market,
 * including CARFAX by their own documentation: user added records are excluded
 * from the Vehicle History Report, and reviewers cannot even attribute work to
 * an arbitrary independent shop. So a driveway oil change simply does not exist
 * anywhere, no matter how diligently it was done.
 *
 * This is the weakest evidence in the product and the trust model says so
 * plainly. It is also the only place this work can be recorded at all, and a
 * record with an honest weak entry beats a record with a hole in it.
 */
export default function LogDiyPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [service, setService] = useState<ServiceKey>("oil_change");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mileage, setMileage] = useState("");
  const [cost, setCost] = useState("");
  const [parts, setParts] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const saveKey = useRef<string | null>(null);

  useEffect(() => {
    getVehicles()
      .then((v) => {
        setVehicles(v);
        if (v.length) setVehicleId(v[0].id);
      })
      .catch(() => setLoadError(true));
  }, []);

  async function save() {
    const vehicle = vehicles?.find((v) => v.id === vehicleId);
    if (!vehicle || saving) return;
    setSaving(true);
    setError(null);
    // Reused if a save fails and the person tries again, so a lost response
    // cannot log the same work twice.
    if (!saveKey.current) saveKey.current = crypto.randomUUID();
    try {
      const odometer = Number(mileage.replace(/[^0-9]/g, ""));
      const amount = Number(cost.replace(/[^0-9.]/g, ""));
      const label = SERVICES[service].label;

      await saveExtractedReceipt(
        {
          vehicle: {
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            vin: vehicle.vin,
            licensePlate: vehicle.licensePlate,
          },
          visit: {
            shop: { name: "Did it myself", storeNumber: null, address: null, phone: null },
            workOrderNumber: null,
            dateIn: date,
            dateOut: date,
            mileage: Number.isFinite(odometer) && odometer > 0 ? odometer : null,
            serviceManager: null,
            technicians: [],
            lineItems: [
              {
                description: parts.trim() ? `${label} (${parts.trim()})` : label,
                kind: "part",
                quantity: 1,
                unitPrice: Number.isFinite(amount) && amount > 0 ? amount : null,
                total: Number.isFinite(amount) && amount > 0 ? amount : null,
                performedBy: "Owner",
                partNumber: null,
              },
            ],
            totals: {
              parts: Number.isFinite(amount) && amount > 0 ? amount : null,
              labor: 0,
              fees: null,
              tax: null,
              total: Number.isFinite(amount) && amount > 0 ? amount : null,
              paymentMethod: null,
            },
            diagnostics: null,
            // Parts bought over the counter carry their own manufacturer
            // warranty, but the owner holds that retail receipt, not this one.
            warranties: [],
          },
          extractionNotes: notes.trim() ? [notes.trim()] : [],
        },
        { vehicleId, intakeMethod: "owner_entry", idempotencyKey: saveKey.current ?? undefined },
      );

      toast.success("Logged");
      router.push(`/vehicles/${vehicleId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that.");
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div>
        <BackHeader href="/" label="Garage" />
        <div className="px-5 pt-6">
          <p role="alert" className="text-sm text-destructive">Could not load your garage.</p>
          <Button variant="outline" className="mt-3" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (vehicles && vehicles.length === 0) {
    return (
      <div>
        <BackHeader href="/" label="Garage" />
        <p className="px-5 pt-6 text-sm text-muted-foreground">Add a vehicle first, then you can log work on it.</p>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <BackHeader href="/" label="Garage" />
      <div className="px-5 pt-3">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Log your own work</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Work you did yourself never reaches any reporting system. This is the only place it gets recorded.
        </p>

        <div className="mt-5 space-y-4">
          {vehicles && vehicles.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="log-vehicle">Vehicle</Label>
              <Select value={vehicleId} onValueChange={(v) => setVehicleId(v ?? "")}>
                <SelectTrigger id="log-vehicle" aria-label="Vehicle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {vehicleTitle(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="log-service">What did you do?</Label>
            <Select value={service} onValueChange={(v) => v && setService(v as ServiceKey)}>
              <SelectTrigger id="log-service" aria-label="What did you do">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIY_SERVICES.map((key) => (
                  <SelectItem key={key} value={key}>
                    {SERVICES[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="odo">Odometer</Label>
              <Input
                id="odo"
                inputMode="numeric"
                placeholder="62786"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cost">Parts cost</Label>
              <Input
                id="cost"
                inputMode="decimal"
                placeholder="42.00"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parts">What you used</Label>
              <Input
                id="parts"
                placeholder="Mobil 1 0W-20"
                value={parts}
                onChange={(e) => setParts(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              className="min-h-20"
              placeholder="Anything you want to remember next time."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <Button className="w-full" size="lg" onClick={save} disabled={saving || !vehicleId}>
            {saving ? "Saving…" : "Log it"}
          </Button>

          {/* Said up front rather than discovered later at a sale. */}
          <p className="text-[11px] leading-snug text-muted-foreground">
            This is recorded as owner entered, the weakest tier in the record, because nothing outside your own account
            corroborates it. Keeping the parts receipt is what turns it into evidence.
          </p>
        </div>
      </div>
    </div>
  );
}
