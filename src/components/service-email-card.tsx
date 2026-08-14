"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Mail } from "lucide-react";

/**
 * The Glovebox address, presented as what it is: a one time setup that makes
 * every future invoice file itself. The pitch line matters more than the
 * feature; "give this at the counter" is the entire user behavior.
 */
export function ServiceEmailCard() {
  const [address, setAddress] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void fetch("/api/garage/address")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.address) {
          setAddress(d.address as string);
          setConfigured(Boolean(d.configured));
        }
      })
      .catch(() => null);
  }, []);

  if (!address) return null;

  async function copy() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3.5">
      <div className="flex items-center gap-2">
        <Mail className="size-4 text-muted-foreground" />
        <p className="font-display text-sm font-semibold uppercase tracking-[0.14em]">Your service email</p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-sm">{address}</code>
        <button
          type="button"
          onClick={copy}
          disabled={!configured}
          aria-label="Copy service email"
          className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          {copied ? <Check className="size-4 text-covered" /> : <Copy className="size-4" />}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        {configured
          ? "Give this as your email at any counter. Invoices the shop sends file themselves, at the strongest trust tier this record has."
          : "This will be your address once inbound mail is connected. The token is already yours."}
      </p>
    </div>
  );
}
