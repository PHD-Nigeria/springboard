"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PublicNavItem } from "@/lib/content/queries";

/**
 * Restrained editorial header: wordmark, a small set of section links, and
 * search — not a dense app-style nav bar. Client component only because the
 * mobile menu needs open/closed state; everything it renders is otherwise
 * static. Links themselves are no longer hard-coded here — `items` comes
 * from `nav_items` (public, `is_visible = true`, ordered by
 * `display_order`), fetched once in the root layout via
 * `getPublicNavItems()` and passed down, same pattern as
 * `getPublicSiteSettings()`. An admin/editor manages the actual rows at
 * /admin/navigation; this component only renders whatever it's given.
 */
export function Navigation({ items }: { items: PublicNavItem[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // The root layout wraps every route (Next.js requires exactly one root
  // layout unless the whole app is restructured into route-group-scoped
  // roots — too large a change for what's otherwise a one-line exclusion).
  // /admin has its own dedicated nav (src/components/admin), so the public
  // masthead — and Footer, via the same check — simply don't render there.
  if (pathname?.startsWith("/admin")) return null;

  // className is passed in per call site (desktop vs. mobile use different
  // base classes) so an external link's <a> and an internal link's <Link>
  // end up with identically-structured markup to what each context
  // rendered before this was data-driven — just swapping which element
  // renders it and adding the safe rel="noopener noreferrer" new-tab case.
  function renderLink(item: PublicNavItem, className: string, onClick?: () => void) {
    const isActive = !item.isExternal && pathname === item.href;
    const resolvedClassName = `${className} ${isActive ? "text-foreground" : "text-foreground-muted"}`;

    if (item.isExternal) {
      return (
        <a
          key={item.id}
          href={item.href}
          target={item.openInNewTab ? "_blank" : undefined}
          rel={item.openInNewTab ? "noopener noreferrer" : undefined}
          onClick={onClick}
          className={resolvedClassName}
        >
          {item.label}
          {item.openInNewTab && <span className="sr-only"> (opens in new tab)</span>}
        </a>
      );
    }

    return (
      <Link
        key={item.id}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        onClick={onClick}
        className={resolvedClassName}
      >
        {item.label}
      </Link>
    );
  }

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
          {items.map((item) =>
            renderLink(item, "font-body text-sm tracking-wide transition-colors duration-fast hover:text-secondary-400")
          )}
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
          {items.map((item) =>
            renderLink(
              item,
              "rounded-sm px-2 py-3 font-body text-sm transition-colors duration-fast hover:text-secondary-400",
              () => setMobileOpen(false)
            )
          )}
        </nav>
      )}
    </header>
  );
}
