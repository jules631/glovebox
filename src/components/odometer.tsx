import { cn } from "@/lib/utils";

/** Mechanical odometer readout: boxed mono digits, like the real thing. */
export function Odometer({ miles, className }: { miles: number | null; className?: string }) {
  if (miles == null) {
    return (
      <span className={cn("font-mono text-sm text-muted-foreground", className)}>
        <span aria-hidden="true">— mi</span>
        <span className="sr-only">Mileage unknown</span>
      </span>
    );
  }
  const digits = String(miles).padStart(6, "0").split("");
  return (
    <span
      className={cn("inline-flex items-baseline gap-1.5", className)}
      role="text"
      aria-label={`${miles.toLocaleString("en-US")} miles`}
    >
      <span aria-hidden="true" className="inline-flex gap-px overflow-hidden rounded-sm">
        {digits.map((d, i) => (
          <span
            key={i}
            className="flex h-6 w-4 items-center justify-center bg-foreground font-mono text-sm font-medium tabular-nums text-background"
          >
            {d}
          </span>
        ))}
      </span>
      <span aria-hidden="true" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">mi</span>
    </span>
  );
}
