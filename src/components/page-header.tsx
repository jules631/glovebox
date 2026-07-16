import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function AppHeader() {
  return (
    <header className="px-5 pb-2 pt-6">
      <p className="font-display text-3xl font-bold uppercase tracking-[0.08em] text-foreground">
        Glovebox
      </p>
      <p className="text-sm text-muted-foreground">
        Every shop. One service history.
      </p>
    </header>
  );
}

export function BackHeader({ href, label }: { href: string; label: string }) {
  return (
    <header className="px-5 pb-1 pt-5">
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        {label}
      </Link>
    </header>
  );
}
