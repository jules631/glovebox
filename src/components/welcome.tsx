"use client";

import { useRouter } from "next/navigation";
import { CarFront, KeyRound, Mail, ScanLine, SearchCheck, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";

const audiences = [
  {
    icon: KeyRound,
    role: "Own it",
    line: "Know what is covered before you authorize work. Never pay twice.",
  },
  {
    icon: Tag,
    role: "Sell it",
    line: "A history kept for years is proof no listing photo can match.",
  },
  {
    icon: SearchCheck,
    role: "Buy it",
    line: "Every record shows how it arrived and how a skeptic can check it.",
  },
];

const waysIn = [
  {
    icon: CarFront,
    text: "Add your car by VIN. Factory details and every open recall appear before your first receipt.",
  },
  {
    icon: ScanLine,
    text: "Snap a receipt or upload an invoice. Line items become services, coverage, and costs.",
  },
  {
    icon: Mail,
    text: "Give your Glovebox address at the counter. Invoices the shop emails file themselves.",
  },
];

/**
 * The first screen for an empty garage. The garage list replaces it the moment
 * a real vehicle exists, so this carries the entire pitch: what the product is
 * worth to the owner, the seller, and the buyer, and the three ways a record
 * gets in. The demo sits beside the real path because seeing a lived history
 * is faster than describing one, and it stays labeled as a demo.
 */
export function Welcome({ onLoadDemo, loadingDemo }: { onLoadDemo: () => void; loadingDemo: boolean }) {
  const router = useRouter();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-3xl font-bold leading-tight">
          Proof your car was cared for.
        </h2>
        <p className="mt-2 text-sm leading-snug text-muted-foreground">
          Every shop keeps its own records. Glovebox gathers them into one service history that stays
          with the car, shows what is still covered, and gives the next buyer a way to check every claim.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {audiences.map(({ icon: Icon, role, line }) => (
          <div key={role} className="rounded-lg border border-border bg-card p-3">
            <Icon className="size-4 text-muted-foreground" />
            <p className="mt-2 font-display text-sm font-semibold uppercase tracking-[0.14em]">{role}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{line}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={() => router.push("/add")}>Add your car by VIN</Button>
        <Button variant="outline" onClick={onLoadDemo} disabled={loadingDemo}>
          {loadingDemo ? "Loading…" : "See it on a real car"}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.14em]">
          How a record gets in
        </p>
        <ul className="mt-3 space-y-3">
          {waysIn.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-sm leading-snug">{text}</p>
            </li>
          ))}
        </ul>
      </div>

      <p className="px-1 text-[11px] leading-snug text-muted-foreground">
        Records are timestamped by the server and append only. A seller can add to a history but
        cannot quietly rewrite it, which is why the next buyer can believe it.
      </p>
    </div>
  );
}
