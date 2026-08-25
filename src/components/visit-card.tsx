import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { ServiceVisit } from "@/lib/types";
import { fmtDate, fmtMiles, fmtUSD } from "@/lib/format";

function headline(visit: ServiceVisit): string {
  const services = visit.lineItems.filter((li) => li.kind !== "fee" && (li.total ?? 0) >= 0);
  const names = services.slice(0, 2).map((li) => li.description);
  const more = services.length - names.length;
  return names.join(" · ") + (more > 0 ? ` +${more} more` : "");
}

export function VisitCard({ visit, activeWarrantyCount }: { visit: ServiceVisit; activeWarrantyCount: number }) {
  return (
    <Link
      href={`/vehicles/${visit.vehicleId}/visits/${visit.id}`}
      className="block rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-lg font-semibold uppercase leading-tight tracking-wide">
          {visit.shop.name}
        </p>
        <p className="shrink-0 font-mono text-sm font-medium tabular-nums">{fmtUSD(visit.totals.total)}</p>
      </div>
      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{headline(visit)}</p>
      <div className="mt-2.5 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{fmtDate(visit.dateIn)}</span>
        {visit.mileage != null && (
          <span className="font-mono tabular-nums">{fmtMiles(visit.mileage)}</span>
        )}
        {activeWarrantyCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 font-medium text-covered">
            <ShieldCheck className="size-3.5" />
            {activeWarrantyCount === 1 ? "1 active warranty" : `${activeWarrantyCount} active warranties`}
          </span>
        )}
      </div>
    </Link>
  );
}
