import { AlertTriangle, ClipboardCheck, Gauge, ShieldQuestion, TrendingDown } from "lucide-react";
import type { DueItem, WearSeries, CompletenessReport } from "@/lib/health";
import type { RepeatFinding } from "@/lib/repeat";
import type { RecordTrustSummary } from "@/lib/provenance";
import type { MileageAnalysis } from "@/lib/mileage";
import type { ClaimPacket } from "@/lib/warranty";
import { fmtDate, fmtMiles, fmtUSD } from "@/lib/format";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</h2>
  );
}

/**
 * The do-not-pay-twice alert.
 *
 * This is the founding story in the README and the highest value thing the
 * product can say, so it sits above everything else on the page.
 */
export function RepeatAlerts({ repeats }: { repeats: RepeatFinding[] }) {
  if (!repeats.length) return null;

  // Two different claims, so two different presentations. A finding backed by
  // the shop's own printed terms is close to a fact. A finding backed by a
  // generic default this product picked is a question worth asking, and
  // dressing it up as the former is how a useful alert turns into noise the
  // user learns to skip.
  const stated = repeats.filter((r) => r.confidence === "stated");
  const inferred = repeats.filter((r) => r.confidence === "inferred");

  return (
    <>
      {stated.length > 0 && (
        <section className="space-y-2">
          <SectionHeading>Paid twice for the same work</SectionHeading>
          {stated.map((r, i) => (
            <div key={i} className="rounded-lg border-2 border-amber-500/60 bg-amber-500/5 p-3.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">
                    {r.label} · {fmtUSD(r.amountAtRisk)} at risk
                  </p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">{r.summary}</p>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {inferred.length > 0 && (
        <section className="space-y-2">
          <SectionHeading>Worth asking about</SectionHeading>
          {inferred.map((r, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3.5">
              <div className="flex items-start gap-2">
                <ShieldQuestion className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{r.label}</p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">{r.summary}</p>
                  <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                    The earlier receipt did not print its terms, so this compares against what work like this is
                    commonly warranted for. Check the original invoice before raising it.
                  </p>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

/** What is due, from generic intervals against a derived mileage rate. */
export function DueList({ items }: { items: DueItem[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <SectionHeading>Due next</SectionHeading>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {items.map((item) => (
          <li key={item.key} className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">
                {item.lastDone
                  ? `Last done ${fmtDate(item.lastDone.date)} at ${item.lastDone.shopName}`
                  : "Never recorded here"}
              </p>
            </div>
            <span
              className={
                item.state === "overdue"
                  ? "shrink-0 font-mono text-xs font-semibold tabular-nums text-amber-700"
                  : "shrink-0 font-mono text-xs tabular-nums text-muted-foreground"
              }
            >
              {item.state === "overdue"
                ? "Overdue"
                : item.state === "never_recorded"
                  ? "No record"
                  : item.milesUntilDue != null
                    ? `in ${fmtMiles(Math.max(0, item.milesUntilDue))}`
                    : item.dueAtDate
                      ? fmtDate(item.dueAtDate)
                      : "—"}
            </span>
          </li>
        ))}
      </ul>
      {/* Real per-VIN schedules are licensed data. Saying so is cheaper than
          being quietly wrong about someone's specific car. */}
      <p className="text-[11px] leading-snug text-muted-foreground">
        Intervals are generic, not your manufacturer&rsquo;s schedule for this VIN. Treat them as a prompt to check, not
        as the factory recommendation.
      </p>
    </section>
  );
}

/** Measurements over time. The claim the README makes, finally computed. */
export function WearTrends({ series }: { series: WearSeries[] }) {
  const withRate = series.filter((s) => s.ratePer1000Miles != null && s.ratePer1000Miles < 0);
  if (!series.length) return null;

  return (
    <section className="space-y-2">
      <SectionHeading>What is wearing</SectionHeading>
      {withRate.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3.5 text-xs leading-snug text-muted-foreground">
          Only one set of readings so far. A second inspection gives every measurement a direction, and that is when this
          turns into a wear rate instead of a number.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {withRate.map((s) => (
            <li key={`${s.kind}:${s.position}`} className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs text-muted-foreground">
                  {s.current}/{s.unit === "32nds" ? "32" : s.unit} now, losing{" "}
                  {Math.abs(s.ratePer1000Miles!).toFixed(2)} per 1,000 miles
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 font-mono text-xs tabular-nums text-muted-foreground">
                <TrendingDown className="size-3.5" />
                {s.remainingMiles != null ? `~${fmtMiles(s.remainingMiles)} left` : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The odometer curve, which is both the interval basis and the fraud check. */
export function MileagePanel({ analysis }: { analysis: MileageAnalysis }) {
  const flagged = analysis.anomalies.filter((a) => a.severity !== "info");
  return (
    <section className="space-y-2">
      <SectionHeading>Odometer</SectionHeading>
      <div className="rounded-lg border border-border bg-card p-3.5">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Readings</p>
            <p className="font-mono text-sm tabular-nums">
              {analysis.readings.length} from {analysis.sourceCount} source{analysis.sourceCount === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Driving</p>
            <p className="font-mono text-sm tabular-nums">
              {analysis.milesPerYear != null ? `${analysis.milesPerYear.toLocaleString()} mi/yr` : "Not enough span"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Unrecorded gaps</p>
            <p className="font-mono text-sm tabular-nums">{analysis.gaps.filter((g) => g.likelyUnrecordedService).length}</p>
          </div>
        </div>

        {flagged.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-dashed border-border pt-2.5">
            {flagged.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-snug">
                <Gauge className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
                <span>{a.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * The buyer-facing panel.
 *
 * The point is not to argue the record is true. It is to report where each part
 * of it came from, so someone with every reason to be skeptical can check it
 * themselves. Verifiability, not assertion.
 */
export function TrustPanel({ trust, completeness }: { trust: RecordTrustSummary; completeness: CompletenessReport }) {
  return (
    <section className="space-y-2">
      <SectionHeading>How much of this can be checked</SectionHeading>
      <div className="rounded-lg border border-border bg-card p-3.5">
        <p className="text-sm font-medium leading-snug">{trust.headline}</p>
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{completeness.summary}</p>

        {trust.recordAgeDays != null && (
          <p className="mt-2.5 border-t border-dashed border-border pt-2.5 text-xs text-muted-foreground">
            {/* Record age is the hardest thing here to fake, which is exactly
                why it is stated plainly rather than buried. */}
            Oldest record written {trust.recordAgeDays} days ago
            {trust.recentlyAdded > 0 ? ` · ${trust.recentlyAdded} added in the last 30 days` : ""}.
          </p>
        )}

        {trust.caveats.length > 0 && (
          <ul className="mt-2.5 space-y-1.5">
            {trust.caveats.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-snug text-muted-foreground">
                <ShieldQuestion className="mt-0.5 size-3.5 shrink-0" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * What to actually put on the counter.
 *
 * The gap between "the app says this is covered" and "the shop honors it" is
 * adjudication, and no app closes it. What an app can do is hand over every
 * fact the service advisor needs to look the claim up in their own system.
 */
export function ClaimPacketCard({ packet }: { packet: ClaimPacket }) {
  const rows: Array<[string, string]> = [
    ["Shop", packet.storeNumber ? `${packet.shopName} #${packet.storeNumber}` : packet.shopName],
    ["Phone", packet.shopPhone ?? "—"],
    ["Work order", packet.workOrderNumber ?? "—"],
    ["Service date", fmtDate(packet.serviceDate)],
    ["Odometer then", packet.serviceMileage != null ? fmtMiles(packet.serviceMileage) : "—"],
    ["Paid", packet.amountPaid != null ? fmtUSD(packet.amountPaid) : "—"],
  ];
  if (packet.partNumbers.length) rows.push(["Part numbers", packet.partNumbers.join(", ")]);

  return (
    <div className="rounded-lg border border-border bg-card p-3.5">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="size-4 text-muted-foreground" />
        <p className="font-display text-sm font-semibold uppercase tracking-[0.14em]">Take this to the counter</p>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="font-mono text-xs tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-t border-dashed border-border pt-2.5 text-[11px] leading-snug text-muted-foreground">
        {/* Setting the expectation here is the whole hedge. */}
        The shop decides claims from its own system, not from this record. These are the details they will ask for.
      </p>
    </div>
  );
}
