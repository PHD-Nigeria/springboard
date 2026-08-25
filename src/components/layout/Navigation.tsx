"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Insights", href: "/#more-stories" },
  { label: "People", href: "/#people" },
];

const SEARCH_LINK = { label: "Search", href: "/search" };

/**
 * Restrained editorial header: wordmark, a small set of section links, and
 * search — not a dense app-style nav bar. Client component only because the
 * mobile menu needs open/closed state; everything it renders is otherwise
 * static.
 */
export function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // The root layout wraps every route (Next.js requires exactly one root
  // layout unless the whole app is restructured into route-group-scoped
  // roots — too large a change for what's otherwise a one-line exclusion).
  // /admin has its own dedicated nav (src/components/admin), so the public
  // masthead — and Footer, via the same check — simply don't render there.
  if (pathname?.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-primary-800 bg-primary-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-gutter py-6">
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-wide text-foreground transition-colors duration-fast hover:text-secondary-400"
          onClick={() => setMobileOpen(false)}
        >
          SPRINGBOARD
        </Link>

        <nav className="hidden items-center gap-9 md:flex" aria-label="Primary">
          {[...NAV_LINKS, SEARCH_LINK].map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`font-body text-sm tracking-wide transition-colors duration-fast hover:text-secondary-400 ${
                  isActive ? "text-foreground" : "text-foreground-muted"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          className="font-body text-sm text-foreground md:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? "Close" : "Menu"}
        </button>
      </div>

      {mobileOpen && (
        <nav
          id="mobile-nav"
          aria-label="Primary"
          className="flex flex-col gap-1 border-t border-primary-800 px-gutter py-4 md:hidden"
        >
          {[...NAV_LINKS, SEARCH_LINK].map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
                className={`rounded-sm px-2 py-3 font-body text-sm transition-colors duration-fast hover:text-secondary-400 ${
                  isActive ? "text-foreground" : "text-foreground-muted"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
