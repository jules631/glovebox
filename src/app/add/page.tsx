"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { BackHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveExtractedReceipt } from "@/lib/store";
import type { Recall, VinDecode } from "@/lib/vin";

/**
 * Day one, with no receipts.
 *
 * The hardest problem this product has is that a new owner of a six year old
 * car has nothing to show. Asking them to backfill years of paperwork is asking
 * for a weekend, and they will not do it. A VIN is seventeen characters and
 * yields the year, make, model, engine, and every open recall immediately.
 *
 * Recalls are also the one kind of coverage in this whole product that has no
 * time limit, no mileage limit, and is always free. They appear on no service
 * receipt, because they are keyed to the vehicle rather than to a visit, which
 * means a product that only reads receipts can never see them.
 */
export default function AddVehiclePage() {
  const router = useRouter();
  const [vin, setVin] = useState("");
  const [mileage, setMileage] = useState("");
  const [decode, setDecode] = useState<VinDecode | null>(null);
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [recallsAvailable, setRecallsAvailable] = useState(false);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    const clean = vin.trim().toUpperCase();
    setLooking(true);
    setError(null);
    try {
      const res = await fetch(`/api/vin/${encodeURIComponent(clean)}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? "That VIN could not be looked up.");
      setDecode(payload.decode as VinDecode);
      setRecalls(payload.recalls as Recall[]);
      setRecallsAvailable(Boolean(payload.recallsAvailable));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That VIN could not be looked up.");
      setDecode(null);
    } finally {
      setLooking(false);
    }
  }

  async function save() {
    if (!decode?.make || !decode.model) return;
    setSaving(true);
    try {
      const odometer = Number(mileage.replace(/[^0-9]/g, ""));
      const today = new Date().toISOString().slice(0, 10);

      // A vehicle with no service history is still a record: it establishes the
      // identity and the starting odometer, which is the first point on the
      // mileage curve everything else is measured against.
      const { vehicleId } = await saveExtractedReceipt(
        {
          vehicle: {
            year: decode.year,
            make: decode.make,
            model: decode.model,
            vin: decode.vin,
            licensePlate: null,
          },
          visit: {
            shop: { name: "Added by owner", storeNumber: null, address: null, phone: null },
            workOrderNumber: null,
            dateIn: today,
            dateOut: today,
            mileage: Number.isFinite(odometer) && odometer > 0 ? odometer : null,
            serviceManager: null,
            technicians: [],
            lineItems: [],
            totals: { parts: null, labor: null, fees: null, tax: null, total: null, paymentMethod: null },
            diagnostics: null,
            warranties: [],
          },
          extractionNotes: ["Vehicle added by VIN. No service work recorded."],
        },
        { intakeMethod: "owner_entry" },
      );

      toast.success("Vehicle added");
      router.push(`/vehicles/${vehicleId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that vehicle.");
      setSaving(false);
    }
  }

  return (
    <div className="pb-10">
      <BackHeader href="/" label="Garage" />
      <div className="px-5 pt-3">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Add a vehicle</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The VIN is on the driver&rsquo;s side dashboard, the door jamb sticker, and your insurance card.
        </p>

        <div className="mt-5 space-y-2">
          <Label htmlFor="vin">VIN</Label>
          <Input
            id="vin"
            className="font-mono uppercase"
            placeholder="JM1BM1T7XG1284334"
            maxLength={17}
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
          />
          <Button className="w-full" onClick={lookup} disabled={looking || vin.trim().length !== 17}>
            {looking ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {looking ? "Looking up…" : "Look up this VIN"}
          </Button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {decode && (
          <div className="mt-6 space-y-5">
            <section className="rounded-lg border border-border bg-card p-4">
              <p className="font-display text-xl font-semibold leading-tight">
                {[decode.year, decode.make, decode.model].filter(Boolean).join(" ")}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                {(
                  [
                    ["Body", decode.bodyClass],
                    ["Engine", decode.engine],
                    ["Drive", decode.driveType],
                    ["Fuel", decode.fuelType],
                    ["Trim", decode.trim],
                    ["Built in", decode.plantCountry],
                  ] as Array<[string, string | null]>
                )
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
                      <dd className="text-sm">{value}</dd>
                    </div>
                  ))}
              </dl>
              <p className="mt-3 border-t border-dashed border-border pt-2.5 text-[11px] text-muted-foreground">
                Decoded from the public NHTSA vPIC database.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Open recalls
              </h2>
              {!recallsAvailable ? (
                <p className="rounded-lg border border-dashed border-border p-3.5 text-xs text-muted-foreground">
                  Recall data could not be reached right now.
                </p>
              ) : recalls.length === 0 ? (
                <p className="rounded-lg border border-border bg-card p-3.5 text-sm text-muted-foreground">
                  No open recalls listed for this year, make, and model.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recalls.map((r) => (
                    <li key={r.campaignNumber} className="rounded-lg border-2 border-amber-500/60 bg-amber-500/5 p-3.5">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-snug">{r.component}</p>
                          <p className="mt-1 text-xs leading-snug text-muted-foreground">{r.summary}</p>
                          {r.remedy && (
                            <p className="mt-1.5 text-xs leading-snug">
                              <span className="font-medium">Remedy: </span>
                              {r.remedy}
                            </p>
                          )}
                          <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                            NHTSA {r.campaignNumber}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {/* Recalls are the only coverage here with no fine print at all. */}
              <p className="text-[11px] leading-snug text-muted-foreground">
                Recalls have no time or mileage limit and are repaired free at any franchised dealer, whoever owns the
                car now.
              </p>
            </section>

            <div className="space-y-2">
              <Label htmlFor="odometer">Current odometer</Label>
              <p className="text-xs text-muted-foreground">
                One number, and service intervals and coverage limits both become answerable.
              </p>
              <Input
                id="odometer"
                inputMode="numeric"
                placeholder="62786"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
              />
            </div>

            <Button className="w-full" size="lg" onClick={save} disabled={saving}>
              {saving ? "Adding…" : "Add to my garage"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
