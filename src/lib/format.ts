export function fmtUSD(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function fmtMiles(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toLocaleString("en-US")} mi`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtMonthYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function vehicleTitle(v: { year: number | null; make: string; model: string; nickname?: string | null }): string {
  return v.nickname || [v.year, v.make, v.model].filter(Boolean).join(" ");
}

export function vehicleSubtitle(v: { year: number | null; make: string; model: string; nickname?: string | null }): string | null {
  return v.nickname ? [v.year, v.make, v.model].filter(Boolean).join(" ") : null;
}
