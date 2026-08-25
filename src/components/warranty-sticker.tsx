import { BadgeCheck, CircleHelp, Infinity as InfinityIcon } from "lucide-react";
import type { WarrantyStatus } from "@/lib/warranty";
import { fmtDate, fmtMiles, fmtUSD } from "@/lib/format";

/**
 * Active coverage rendered like the static-cling sticker a shop leaves on your
 * windshield.
 *
 * It deliberately never says "you are covered". It says what the receipt said,
 * names the shop that said it, and shows the odometer the check was made
 * against. The shop honors its own record, not this app, and a sticker that
 * overpromises costs the user a wasted trip and costs the product its
 * credibility in the same moment.
 */
export function WarrantySticker({ status }: { status: WarrantyStatus }) {
  const { term, visit, expiresDate, expiresMileage, state, proration, conditions, mileageBasis, mileageBasisIsProjected } = status;

  const lifetime = term.duration === "lifetime";
  const unknown = state === "not_computable";

  return (
    <div
      className={
        unknown
          ? "overflow-hidden rounded-lg border-2 border-dashed border-border bg-card shadow-sm"
          : "overflow-hidden rounded-lg border-2 border-covered bg-card shadow-sm"
      }
    >
      <div
        className={
          unknown
            ? "flex items-center gap-2 bg-muted px-4 py-1.5 text-muted-foreground"
            : "flex items-center gap-2 bg-covered px-4 py-1.5 text-covered-foreground"
        }
      >
        {unknown ? <CircleHelp className="size-4" /> : lifetime ? <InfinityIcon className="size-4" /> : <BadgeCheck className="size-4" />}
        <span className="font-display text-sm font-semibold uppercase tracking-[0.14em]">
          {unknown ? "Coverage stated, no limit given" : lifetime ? "Lifetime coverage" : "Still covered"}
        </span>
      </div>

      <div className="px-4 py-3">
        <p className="font-display text-xl font-semibold uppercase leading-tight tracking-wide text-foreground">
          {term.appliesTo ?? term.description}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {visit.shop.name} · {fmtDate(visit.dateOut ?? visit.dateIn)}
        </p>

        {/* The receipt's own words. Everything below is arithmetic on these. */}
        <p className="mt-2 border-l-2 border-border pl-2.5 text-xs italic leading-snug text-muted-foreground">
          &ldquo;{term.description}&rdquo;
        </p>

        <div className="mt-3 flex flex-wrap gap-6 border-t border-dashed border-border pt-2.5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Good through</p>
            <p className="font-mono text-sm font-medium tabular-nums">
              {expiresDate ? fmtDate(expiresDate) : lifetime ? "No time limit" : "Not stated"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Or odometer</p>
            <p className="font-mono text-sm font-medium tabular-nums">
              {expiresMileage != null ? fmtMiles(expiresMileage) : lifetime ? "No mile limit" : "Not stated"}
            </p>
          </div>
          {proration && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Prorated credit</p>
              <p className="font-mono text-sm font-medium tabular-nums">
                {Math.round(proration.fractionRemaining * 100)}%
                {proration.estimatedCredit != null ? ` · about ${fmtUSD(proration.estimatedCredit)}` : ""}
              </p>
            </div>
          )}
        </div>

        {proration && (
          <p className="mt-2 text-xs leading-snug text-muted-foreground">
            {proration.milesUsed.toLocaleString("en-US")} of {proration.basisMiles.toLocaleString("en-US")} warranted
            miles used. The shop prorates against its own current selling price, so treat this as a rough figure, not an
            offer.
          </p>
        )}

        {conditions.length > 0 && (
          <div className="mt-3 border-t border-dashed border-border pt-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Conditions the shop can hold you to
            </p>
            <ul className="mt-1 space-y-0.5">
              {conditions.map((c, i) => (
                <li key={i} className="text-xs leading-snug text-foreground">
                  · {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {mileageBasis != null && (
          <p className="mt-2.5 text-[11px] text-muted-foreground">
            Checked against {fmtMiles(mileageBasis)}
            {mileageBasisIsProjected ? ", estimated from your driving since the last reading" : ""}.
          </p>
        )}
      </div>
    </div>
  );
}
