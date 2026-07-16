import { BadgeCheck } from "lucide-react";
import type { WarrantyStatus } from "@/lib/warranty";
import { fmtDate, fmtMiles } from "@/lib/format";

/**
 * The signature element: active coverage rendered like the static-cling
 * service sticker a shop leaves on your windshield.
 */
export function WarrantySticker({ status }: { status: WarrantyStatus }) {
  const { term, visit, expiresDate, expiresMileage } = status;
  return (
    <div className="overflow-hidden rounded-lg border-2 border-covered bg-card shadow-sm">
      <div className="flex items-center gap-2 bg-covered px-4 py-1.5 text-covered-foreground">
        <BadgeCheck className="size-4" />
        <span className="font-display text-sm font-semibold uppercase tracking-[0.14em]">
          Still covered
        </span>
      </div>
      <div className="px-4 py-3">
        <p className="font-display text-xl font-semibold uppercase leading-tight tracking-wide text-foreground">
          {term.appliesTo ?? term.description}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {visit.shop.name} · {fmtDate(visit.dateOut ?? visit.dateIn)}
        </p>
        <div className="mt-3 flex gap-6 border-t border-dashed border-border pt-2.5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Good through
            </p>
            <p className="font-mono text-sm font-medium tabular-nums">
              {expiresDate ? fmtDate(expiresDate) : "No time limit"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Or odometer
            </p>
            <p className="font-mono text-sm font-medium tabular-nums">
              {expiresMileage != null ? fmtMiles(expiresMileage) : "No mile limit"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
