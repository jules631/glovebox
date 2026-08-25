import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// On the garage screen the wordmark is the page's title, so it is the h1. On
// screens that carry their own h1 (capture), the banner stays a plain element
// to avoid a second competing top-level heading.
export function AppHeader({ asHeading = false }: { asHeading?: boolean }) {
  const Wordmark = asHeading ? "h1" : "p";
  return (
    <header className="px-5 pb-2 pt-6">
      <Wordmark className="font-display text-3xl font-bold uppercase tracking-[0.08em] text-foreground">
        Glovebox
      </Wordmark>
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
