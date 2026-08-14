"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileText, ScanLine, X } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downscaleImage, makeThumbnail } from "@/lib/image";
import { getVehicles, matchVehicle, saveExtractedReceipt } from "@/lib/store";
import { vehicleTitle } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ExtractedReceipt, LineItem, Vehicle, WarrantyTerm } from "@/lib/types";

type Step = "pick" | "processing" | "review";

const STAGES = [
  "Reading the receipt…",
  "Extracting line items…",
  "Finding who did the work…",
  "Checking warranty terms…",
  "Almost there…",
];

export default function CapturePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("pick");
  const [files, setFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [receipt, setReceipt] = useState<ExtractedReceipt | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleChoice, setVehicleChoice] = useState<string>("new");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (step !== "processing") return;
    setStageIndex(0);
    const timer = setInterval(
      () => setStageIndex((i) => Math.min(i + 1, STAGES.length - 1)),
      6000,
    );
    return () => clearInterval(timer);
  }, [step]);

  function addFiles(picked: FileList | null) {
    if (!picked) return;
    setError(null);
    setFiles((prev) => [...prev, ...Array.from(picked)].slice(0, 6));
  }

  async function scan() {
    if (files.length === 0 && !pastedText.trim()) return;
    setStep("processing");
    setError(null);
    try {
      const prepared = await Promise.all(
        files.map((f) => (f.type.startsWith("image/") ? downscaleImage(f) : f)),
      );
      const firstImage = files.find((f) => f.type.startsWith("image/"));
      setThumbnail(firstImage ? await makeThumbnail(firstImage) : null);

      const body = new FormData();
      for (const f of prepared) body.append("files", f);
      if (pastedText.trim()) body.append("text", pastedText.trim());

      const res = await fetch("/api/extract", { method: "POST", body });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Extraction failed. Try again.");
      }
      const extracted = (await res.json()) as ExtractedReceipt;

      const garage = await getVehicles();
      setVehicles(garage);
      const match = await matchVehicle(extracted.vehicle);
      setVehicleChoice(match?.id ?? "new");
      setReceipt(extracted);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong reading that receipt.");
      setStep("pick");
    }
  }

  async function save() {
    if (!receipt) return;
    setSaving(true);
    try {
      // How the record arrived decides its trust tier, so it is recorded at the
      // moment of capture rather than guessed at later. A shop's own PDF is
      // stronger evidence than a photograph of paper, and the record says so.
      const hasPdf = files.some((f) => f.type === "application/pdf");
      const intakeMethod = pastedText.trim() && files.length === 0 ? "shop_email" : hasPdf ? "pdf" : "photo";

      const { vehicleId, visitId } = await saveExtractedReceipt(receipt, {
        vehicleId: vehicleChoice === "new" ? undefined : vehicleChoice,
        receiptThumbnail: thumbnail,
        intakeMethod,
        hasSourceDocument: files.length > 0,
      });
      toast.success("Service record saved");
      router.push(`/vehicles/${vehicleId}/visits/${visitId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that record.");
      setSaving(false);
    }
  }

  return (
    <div>
      <AppHeader />
      <div className="px-5 pt-2">
        {step === "pick" && (
          <PickStep
            files={files}
            pastedText={pastedText}
            onTextChange={setPastedText}
            error={error}
            onPick={() => inputRef.current?.click()}
            onRemove={(i) => setFiles((prev) => prev.filter((_, j) => j !== i))}
            onScan={scan}
          />
        )}
        {step === "processing" && <ProcessingStep stage={STAGES[stageIndex]} />}
        {step === "review" && receipt && (
          <ReviewStep
            receipt={receipt}
            setReceipt={setReceipt}
            vehicles={vehicles}
            vehicleChoice={vehicleChoice}
            setVehicleChoice={setVehicleChoice}
            onSave={save}
            saving={saving}
          />
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function PickStep({
  files,
  pastedText,
  onTextChange,
  error,
  onPick,
  onRemove,
  onScan,
}: {
  files: File[];
  pastedText: string;
  onTextChange: (value: string) => void;
  error: string | null;
  onPick: () => void;
  onRemove: (index: number) => void;
  onScan: () => void;
}) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Scan a receipt</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Photograph the invoice from any shop, or upload a PDF. The full work order extracts more
        than the card receipt: technicians, measurements, and warranty terms.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onPick}
        className="mt-5 flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border py-10 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Camera className="size-8" strokeWidth={1.6} />
        <span className="text-sm font-medium">Take a photo or choose a file</span>
        <span className="text-xs">Multi page? Add one photo per page.</span>
      </button>

      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Remove ${f.name}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Pasting beats photographing whenever the shop already emailed an
          invoice, which dealers and chains almost always do. It removes the
          camera, the glare, and the standing-at-the-counter problem, and it is
          the honest stand in for full email ingestion, which needs an inbound
          mail service this prototype does not have. */}
      <div className="mt-6">
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">or paste it</span>
          <Separator className="flex-1" />
        </div>
        <Label htmlFor="invoice-text" className="mt-4 block text-sm font-medium">
          Paste an emailed invoice
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Forward or copy the whole email. Headers and quoting are fine; they get ignored.
        </p>
        <Textarea
          id="invoice-text"
          className="mt-2 min-h-32"
          placeholder="Paste the invoice text here…"
          value={pastedText}
          onChange={(e) => onTextChange(e.target.value)}
        />
      </div>

      <Button
        className="mt-5 w-full"
        size="lg"
        disabled={files.length === 0 && pastedText.trim().length === 0}
        onClick={onScan}
      >
        <ScanLine className="size-4" />
        {files.length === 0 && pastedText.trim() ? "Read invoice" : "Scan receipt"}
      </Button>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Tips: flatten the receipt, avoid glare, include the whole page.
      </p>
    </div>
  );
}

function ProcessingStep({ stage }: { stage: string }) {
  return (
    <div className="flex flex-col items-center pt-16 text-center">
      <div className="relative flex size-24 items-center justify-center overflow-hidden rounded-lg border-2 border-primary/30">
        <FileText className="size-10 text-muted-foreground" strokeWidth={1.4} />
        <div className="absolute inset-x-0 h-0.5 animate-scan bg-primary" />
      </div>
      <p className="mt-6 font-display text-lg font-semibold uppercase tracking-wide">{stage}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        A detailed invoice takes 20 to 40 seconds to read.
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  inputMode,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "numeric" | "decimal";
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        className="mt-1"
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function numOrNull(v: string): number | null {
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

function ReviewStep({
  receipt,
  setReceipt,
  vehicles,
  vehicleChoice,
  setVehicleChoice,
  onSave,
  saving,
}: {
  receipt: ExtractedReceipt;
  setReceipt: (r: ExtractedReceipt) => void;
  vehicles: Vehicle[];
  vehicleChoice: string;
  setVehicleChoice: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { vehicle, visit } = receipt;

  const setVehicle = (patch: Partial<ExtractedReceipt["vehicle"]>) =>
    setReceipt({ ...receipt, vehicle: { ...vehicle, ...patch } });
  const setVisit = (patch: Partial<ExtractedReceipt["visit"]>) =>
    setReceipt({ ...receipt, visit: { ...visit, ...patch } });
  const setLineItem = (i: number, patch: Partial<LineItem>) =>
    setVisit({ lineItems: visit.lineItems.map((li, j) => (j === i ? { ...li, ...patch } : li)) });
  const setWarranty = (i: number, patch: Partial<WarrantyTerm>) =>
    setVisit({ warranties: visit.warranties.map((w, j) => (j === i ? { ...w, ...patch } : w)) });

  return (
    <div className="pb-8">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Check the record</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The scan did the reading. Confirm it got things right before saving.
      </p>

      {receipt.extractionNotes.length > 0 && (
        <div className="mt-4 rounded-lg border border-caution/40 bg-caution/10 p-3 text-sm">
          <p className="font-medium">Worth a look:</p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {receipt.extractionNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Vehicle */}
      <section className="mt-5 rounded-lg border border-border bg-card p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Vehicle
        </h2>
        <div className="mt-3">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Add this visit to
          </Label>
          <Select value={vehicleChoice} onValueChange={(v) => setVehicleChoice(v ?? "new")}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {vehicleTitle(v)}
                </SelectItem>
              ))}
              <SelectItem value="new">
                New vehicle: {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {vehicleChoice === "new" && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field
              label="Year"
              value={vehicle.year?.toString() ?? ""}
              inputMode="numeric"
              onChange={(v) => setVehicle({ year: numOrNull(v) })}
            />
            <Field label="Make" value={vehicle.make} onChange={(v) => setVehicle({ make: v })} />
            <Field label="Model" value={vehicle.model} onChange={(v) => setVehicle({ model: v })} />
            <Field
              label="Plate"
              value={vehicle.licensePlate ?? ""}
              onChange={(v) => setVehicle({ licensePlate: v || null })}
            />
          </div>
        )}
      </section>

      {/* Visit */}
      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Visit
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field
            label="Shop"
            value={visit.shop.name}
            onChange={(v) => setVisit({ shop: { ...visit.shop, name: v } })}
          />
          <Field
            label="Date"
            value={visit.dateIn ?? ""}
            placeholder="YYYY-MM-DD"
            onChange={(v) => setVisit({ dateIn: v || null })}
          />
          <Field
            label="Odometer (mi)"
            value={visit.mileage?.toString() ?? ""}
            inputMode="numeric"
            onChange={(v) => setVisit({ mileage: numOrNull(v) })}
          />
          <Field
            label="Work order #"
            value={visit.workOrderNumber ?? ""}
            onChange={(v) => setVisit({ workOrderNumber: v || null })}
          />
        </div>
        {visit.technicians.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Serviced by {visit.technicians.join(", ")}
            {visit.serviceManager ? ` · Manager: ${visit.serviceManager}` : ""}
          </p>
        )}
      </section>

      {/* Line items */}
      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Work performed
        </h2>
        <ul className="mt-2 divide-y divide-dashed divide-border">
          {visit.lineItems.map((li, i) => (
            <li key={i} className="flex items-center gap-2 py-2">
              <Input
                className="h-8 flex-1 border-0 px-1 shadow-none focus-visible:ring-1"
                value={li.description}
                onChange={(e) => setLineItem(i, { description: e.target.value })}
              />
              <Input
                className="h-8 w-20 border-0 px-1 text-right font-mono text-sm shadow-none focus-visible:ring-1"
                value={li.total?.toString() ?? ""}
                inputMode="decimal"
                placeholder="0.00"
                onChange={(e) => setLineItem(i, { total: numOrNull(e.target.value) })}
              />
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-semibold">
          <span>Total</span>
          <Input
            className="h-8 w-24 border-0 px-1 text-right font-mono text-sm font-semibold shadow-none focus-visible:ring-1"
            value={visit.totals.total?.toString() ?? ""}
            inputMode="decimal"
            onChange={(e) =>
              setVisit({ totals: { ...visit.totals, total: numOrNull(e.target.value) } })
            }
          />
        </div>
      </section>

      {/* Warranties
          The heaviest judgment on this screen. Everything else the extractor
          gets wrong costs a wrong number in a history; a warranty read wrong
          costs a wasted trip to a counter, or a claim never made. Duration is
          the field that matters most, because "lifetime" never expires on its
          own, so it is a visible choice rather than a hidden default. */}
      {visit.warranties.length > 0 && (
        <section className="mt-4 rounded-lg border border-covered/40 bg-covered/5 p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-covered">
            Warranty coverage found
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Check these against the fine print. They decide what you can claim later.
          </p>
          <ul className="mt-3 space-y-3">
            {visit.warranties.map((w, i) => (
              <li key={i} className="rounded-md bg-card p-3">
                <p className="text-sm font-medium">{w.appliesTo ?? w.description}</p>
                <p className="mt-0.5 text-xs italic text-muted-foreground">&ldquo;{w.description}&rdquo;</p>

                <div className="mt-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    How long does it run
                  </p>
                  <div className="mt-1.5 flex gap-1.5">
                    {(
                      [
                        ["bounded", "Months or miles"],
                        ["lifetime", "Lifetime"],
                        ["unstated", "Not stated"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setWarranty(i, {
                            duration: value,
                            // Lifetime coverage with a stale month or mile bound
                            // still hanging off it would expire something the
                            // receipt says never expires.
                            ...(value === "lifetime" ? { months: null, miles: null } : {}),
                          })
                        }
                        className={cn(
                          "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                          w.duration === value
                            ? "border-covered bg-covered text-covered-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-foreground/30",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {w.duration === "bounded" && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field
                      label="Months"
                      value={w.months?.toString() ?? ""}
                      inputMode="numeric"
                      onChange={(v) => setWarranty(i, { months: numOrNull(v) })}
                    />
                    <Field
                      label="Miles"
                      value={w.miles?.toString() ?? ""}
                      inputMode="numeric"
                      onChange={(v) => setWarranty(i, { miles: numOrNull(v) })}
                    />
                  </div>
                )}

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setWarranty(i, {
                        prorated: !w.prorated,
                        ...(w.prorated ? { proratedBasisMiles: null } : {}),
                      })
                    }
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      w.prorated
                        ? "border-covered bg-covered text-covered-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/30",
                    )}
                  >
                    {w.prorated ? "Prorated payout" : "Not prorated"}
                  </button>
                  {w.prorated && (
                    <div className="mt-2">
                      <Field
                        label="Warranted mileage the credit is figured against"
                        value={w.proratedBasisMiles?.toString() ?? ""}
                        inputMode="numeric"
                        onChange={(v) => setWarranty(i, { proratedBasisMiles: numOrNull(v) })}
                      />
                    </div>
                  )}
                </div>

                {/* Conditions decide whether a claim actually succeeds, and they
                    are the part of a receipt people never read. Editable, because
                    they are also the part an extractor most often misses. */}
                {/* Read only. A wrong mapping here misnames the items on a claim
                    packet but changes no coverage math, so it is shown to be
                    checked rather than given an index picker nobody would use. */}
                <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
                  <span className="font-medium uppercase tracking-wider">Covers: </span>
                  {w.coversLineItems.length
                    ? w.coversLineItems
                        .map((idx) => visit.lineItems[idx]?.description)
                        .filter(Boolean)
                        .join(", ")
                    : "not tied to specific line items"}
                </p>

                <div className="mt-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Conditions attached
                  </p>
                  <ul className="mt-1.5 space-y-1.5">
                    {w.conditions.map((c, ci) => (
                      <li key={ci} className="flex items-center gap-1.5">
                        <Input
                          className="h-8 flex-1 text-xs"
                          value={c}
                          onChange={(e) =>
                            setWarranty(i, {
                              conditions: w.conditions.map((x, xi) => (xi === ci ? e.target.value : x)),
                            })
                          }
                        />
                        <button
                          type="button"
                          aria-label="Remove condition"
                          onClick={() =>
                            setWarranty(i, { conditions: w.conditions.filter((_, xi) => xi !== ci) })
                          }
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setWarranty(i, { conditions: [...w.conditions, ""] })}
                    className="mt-1.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Add a condition
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Button className="mt-5 w-full" size="lg" onClick={onSave} disabled={saving}>
        {saving ? "Saving…" : "Save to service history"}
      </Button>
    </div>
  );
}
