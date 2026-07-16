"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Warehouse, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Garage", icon: Warehouse },
  { href: "/capture", label: "Scan receipt", icon: ScanLine },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" || pathname.startsWith("/vehicles") : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
