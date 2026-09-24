"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PublicNavItem } from "@/lib/content/queries";

/**
 * Restrained editorial header: wordmark, a small set of section links, and
 * search — not a dense app-style nav bar. Client component only because the
 * mobile menu (and now each desktop group's dropdown) needs open/closed
 * state; everything it renders is otherwise static. Links themselves are no
 * longer hard-coded here — `items` comes from `nav_items` (public,
 * `is_visible = true`, ordered by `display_order`, nested into a two-level
 * tree by getPublicNavItems()), fetched once in the root layout via
 * getPublicNavItems() and passed down, same pattern as getPublicSiteSettings().
 * An admin/editor manages the actual rows at /admin/navigation; this
 * component only renders whatever it's given.
 *
 * Each top-level item is either a group heading (has `children`, e.g.
 * "People & Culture") or a standalone link (no `children`, e.g. "Search").
 * A group heading itself never navigates — its href is always the empty
 * string the nav-hierarchy migration reserves for that case.
 */
export function Navigation({ items }: { items: PublicNavItem[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Which top-level group's dropdown/accordion is open — one at a time,
  // desktop and mobile share this state since only one nav renders at once
  // per viewport. Keyed by nav item id, not index, so it survives items
  // being reordered/added in the CMS between renders.
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const pathname = usePathname();

  // The root layout wraps every route (Next.js requires exactly one root
  // layout unless the whole app is restructured into route-group-scoped
  // roots — too large a change for what's otherwise a one-line exclusion).
  // /admin has its own dedicated nav (src/components/admin), so the public
  // masthead — and Footer, via the same check — simply don't render there.
  if (pathname?.startsWith("/admin")) return null;

  function closeAll() {
    setMobileOpen(false);
    setOpenGroupId(null);
  }

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
          onClick={closeAll}
        >
          SPRINGBOARD
        </Link>

        <nav className="hidden items-center gap-9 md:flex" aria-label="Primary">
          {items.map((item) => {
            if (!item.children) {
              return renderLink(item, "font-body text-sm tracking-wide transition-colors duration-fast hover:text-secondary-400");
            }

            const isOpen = openGroupId === item.id;
            return (
              <div key={item.id} className="relative" onMouseLeave={() => setOpenGroupId((id) => (id === item.id ? null : id))}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  onMouseEnter={() => setOpenGroupId(item.id)}
                  onClick={() => setOpenGroupId((id) => (id === item.id ? null : item.id))}
                  className="flex items-center gap-1.5 font-body text-sm tracking-wide text-foreground-muted transition-colors duration-fast hover:text-secondary-400"
                >
                  {item.label}
                  <span aria-hidden className={`text-xs transition-transform duration-fast ${isOpen ? "rotate-180" : ""}`}>
                    ▾
                  </span>
                </button>
                {isOpen && (
                  <div className="absolute top-full left-0 z-50 mt-3 min-w-48 border border-primary-800 bg-primary-900 py-2 shadow-lg">
                    {item.children.map((child) =>
                      renderLink(child, "block px-4 py-2.5 font-body text-sm tracking-wide transition-colors duration-fast hover:text-secondary-400", () =>
                        setOpenGroupId(null)
                      )
                    )}
                  </div>
                )}
              </div>
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
        <nav id="mobile-nav" aria-label="Primary" className="flex flex-col gap-1 border-t border-primary-800 px-gutter py-4 md:hidden">
          {items.map((item) => {
            if (!item.children) {
              return renderLink(
                item,
                "rounded-sm px-2 py-3 font-body text-sm transition-colors duration-fast hover:text-secondary-400",
                closeAll
              );
            }

            const isOpen = openGroupId === item.id;
            return (
              <div key={item.id} className="border-b border-primary-800 last:border-b-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`mobile-group-${item.id}`}
                  onClick={() => setOpenGroupId((id) => (id === item.id ? null : item.id))}
                  className="flex w-full items-center justify-between rounded-sm px-2 py-3 font-body text-sm text-foreground"
                >
                  {item.label}
                  <span aria-hidden className={`text-xs transition-transform duration-fast ${isOpen ? "rotate-180" : ""}`}>
                    ▾
                  </span>
                </button>
                {isOpen && (
                  <div id={`mobile-group-${item.id}`} className="flex flex-col gap-1 pb-2 pl-4">
                    {item.children.map((child) =>
                      renderLink(child, "rounded-sm px-2 py-2.5 font-body text-sm transition-colors duration-fast hover:text-secondary-400", closeAll)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      )}
    </header>
  );
}
