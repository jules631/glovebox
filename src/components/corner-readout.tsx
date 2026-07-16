import { cn } from "@/lib/utils";
import type { Measurement } from "@/lib/types";

// Per-corner measurement readout for tread depth and brake linings.
// Values are always shown as text; color is reserved for genuinely low
// readings and always accompanied by a word, never color alone.

const CORNER_LABELS: Record<string, string> = {
  "front-left": "FL",
  "front-right": "FR",
  "rear-left": "RL",
  "rear-right": "RR",
};

const CORNER_ORDER = ["front-left", "front-right", "rear-left", "rear-right"];

type Level = "ok" | "monitor" | "replace";

function level(value: number, unit: string): Level {
  // Thresholds for 32nds of an inch, the unit on US inspection sheets.
  if (unit !== "32nds") return "ok";
  if (value <= 2) return "replace";
  if (value <= 4) return "monitor";
  return "ok";
}

const LEVEL_WORD: Record<Level, string | null> = {
  ok: null,
  monitor: "Monitor",
  replace: "Replace",
};

export function CornerReadout({
  title,
  measurements,
  scaleMax = 12,
}: {
  title: string;
  measurements: Measurement[];
  scaleMax?: number;
}) {
  if (!measurements.length) return null;

  const ordered = [...measurements].sort(
    (a, b) => CORNER_ORDER.indexOf(a.position) - CORNER_ORDER.indexOf(b.position),
  );

  return (
    <div>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        {ordered.map((m) => {
          const lvl = level(m.value, m.unit);
          const word = LEVEL_WORD[lvl];
          const pct = Math.min(100, (m.value / scaleMax) * 100);
          return (
            <div key={m.position}>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {CORNER_LABELS[m.position] ?? m.position}
                </span>
                <span className="font-mono text-sm font-medium tabular-nums">
                  {m.value}
                  {m.unit === "32nds" ? "/32″" : ` ${m.unit}`}
                  {word && (
                    <span
                      className={cn(
                        "ml-1.5 text-[11px] font-sans font-semibold uppercase",
                        lvl === "replace" ? "text-destructive" : "text-caution",
                      )}
                    >
                      {word}
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full",
                    lvl === "replace" ? "bg-destructive" : lvl === "monitor" ? "bg-caution" : "bg-foreground/60",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
