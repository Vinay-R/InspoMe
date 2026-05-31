"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Library, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/library", label: "Library", icon: Library, match: /^\/(library|inspo)/ },
  { href: "/analytics", label: "Analytics", icon: BarChart3, match: /^\/analytics/ },
] as const;

export function BottomNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
    >
      <div className="mx-auto grid max-w-3xl grid-cols-2 px-5 pt-2">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match.test(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-6" />
              <span className="text-[11px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function HeaderTabs() {
  const pathname = usePathname() ?? "";
  return (
    <div className="hidden md:flex items-center gap-1">
      {TABS.map(({ href, label, match }) => {
        const active = match.test(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
