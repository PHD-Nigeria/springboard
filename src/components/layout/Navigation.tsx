"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PublicNavItem } from "@/lib/content/queries";
import { ShareIdeasButton } from "@/components/layout/ShareIdeasButton";

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
/** Chevron for group triggers; rotates when open. Decorative, the button carries aria-expanded. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" className={`ml-1 h-3 w-3 shrink-0 transition-transform duration-fast ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  );
}

/**
 * Desktop (xl and up, 1280px+): one balanced line. Logo left, the six primary destinations centred, a hairline
 * divider and Share Your Ideas right. Below that width the compact menu is used (tablets included), so the
 * primary nav is never squeezed or wrapped. The current page gets a restrained lime underline; nothing else is lime.
 */
export function Navigation({ items, ideasEmail = null }: { items: PublicNavItem[]; ideasEmail?: string | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Which top-level group's dropdown/accordion is open (one at a time). Keyed by item id so it survives CMS reordering.
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // /admin has its own dedicated nav, so the public masthead (and Footer) do not render there.
  if (pathname?.startsWith("/admin")) return null;

  function closeAll() {
    setMobileOpen(false);
    setOpenGroupId(null);
  }

  const isPathActive = (item: PublicNavItem) =>
    !item.isExternal && item.href !== "" && (pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false));
  const isGroupActive = (item: PublicNavItem) => Boolean(item.children?.some(isPathActive));

  /** Desktop top-level link/trigger: nowrap, underline grows on hover (muted) and stays lime for the current page. */
  const topClass = (active: boolean) =>
    `relative inline-flex items-center whitespace-nowrap py-2 font-body text-[13px] tracking-wide transition-colors duration-fast hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary-400 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:transition-transform after:duration-fast ${
      active ? "text-foreground after:scale-x-100 after:bg-secondary-400" : "text-foreground-muted after:scale-x-0 after:bg-white/35 hover:after:scale-x-100"
    }`;

  function renderLink(item: PublicNavItem, className: string, onClick?: () => void, hiddenFromTab?: boolean) {
    const active = isPathActive(item);
    const tabIndex = hiddenFromTab ? -1 : undefined;
    if (item.isExternal) {
      return (
        <a key={item.id} href={item.href} target={item.openInNewTab ? "_blank" : undefined} rel={item.openInNewTab ? "noopener noreferrer" : undefined} onClick={onClick} tabIndex={tabIndex} className={className}>
          {item.label}
          {item.openInNewTab && <span className="sr-only"> (opens in new tab)</span>}
        </a>
      );
    }
    return (
      <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined} onClick={onClick} tabIndex={tabIndex} className={className}>
        {item.label}
      </Link>
    );
  }

  const childClass = (item: PublicNavItem) =>
    `block border-l-2 px-4 py-2.5 font-body text-sm tracking-wide whitespace-nowrap transition-colors duration-fast hover:bg-primary-800 hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-secondary-400 ${
      isPathActive(item) ? "border-secondary-400 text-foreground" : "border-transparent text-foreground-muted"
    }`;

  const mobileLinkClass = (active: boolean, nested = false) =>
    `flex min-h-11 items-center border-l-2 py-2 pr-2 font-body text-sm transition-colors duration-fast hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-secondary-400 ${nested ? "pl-6" : "pl-3"} ${
      active ? "border-secondary-400 text-foreground" : "border-transparent text-foreground-muted"
    }`;

  return (
    <header
      className="sticky top-0 z-40 border-b border-primary-800 bg-primary-900/95 backdrop-blur"
      onKeyDown={(event) => {
        if (event.key === "Escape" && mobileOpen) {
          setMobileOpen(false);
          toggleRef.current?.focus();
        }
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-gutter py-5 xl:gap-5">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-display text-lg font-semibold tracking-wide whitespace-nowrap text-foreground transition-colors duration-fast hover:text-secondary-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary-400"
          onClick={closeAll}
        >
          <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 bg-secondary-400" />
          SPRINGBOARD
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-5 xl:flex" aria-label="Primary">
          {items.map((item) => {
            if (!item.children) return renderLink(item, topClass(isPathActive(item)));

            const isOpen = openGroupId === item.id;
            return (
              <div
                key={item.id}
                className="relative"
                onMouseLeave={() => setOpenGroupId((id) => (id === item.id ? null : id))}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && isOpen) {
                    setOpenGroupId(null);
                    event.currentTarget.querySelector("button")?.focus();
                  }
                }}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenGroupId((id) => (id === item.id ? null : id));
                }}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  onMouseEnter={() => setOpenGroupId(item.id)}
                  onClick={() => setOpenGroupId((id) => (id === item.id ? null : item.id))}
                  className={topClass(isGroupActive(item) || isOpen)}
                >
                  {item.label}
                  <Chevron open={isOpen} />
                </button>
                {/*
                  pt-3 (not mt-3) keeps the gap inside this element's own hoverable box so the menu does not close while the
                  pointer crosses it. Always rendered (visibility is CSS-only) so next/link can prefetch its children from
                  page load; hiddenFromTab keeps a closed menu's links out of the keyboard tab order.
                */}
                <div className={`absolute top-full left-0 z-50 min-w-60 pt-3 transition-opacity duration-fast ${isOpen ? "visible opacity-100" : "invisible opacity-0 pointer-events-none"}`} aria-hidden={!isOpen}>
                  <div className="border border-primary-700 bg-primary-900 py-2 shadow-lg">
                    {item.children.map((child) => renderLink(child, childClass(child), () => setOpenGroupId(null), !isOpen))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3 xl:gap-5">
          <span aria-hidden="true" className="hidden h-6 w-px bg-primary-700 xl:block" />
          <ShareIdeasButton email={ideasEmail} />
          <button
            ref={toggleRef}
            type="button"
            className="inline-flex min-h-10 items-center border border-primary-700 px-3 font-body text-sm text-foreground sm:px-3.5 transition-colors duration-fast hover:border-secondary-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-400 xl:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav id="mobile-nav" aria-label="Primary" className="max-h-[calc(100svh-8rem)] overflow-y-auto border-t border-primary-800 px-gutter py-3 xl:hidden">
          <div className="mx-auto flex max-w-6xl flex-col md:grid md:grid-cols-2 md:gap-x-10">
            {items.map((item) => {
              if (!item.children) return renderLink(item, mobileLinkClass(isPathActive(item)), closeAll);

              const isOpen = openGroupId === item.id;
              return (
                <div key={item.id} className="border-b border-primary-800">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`mobile-group-${item.id}`}
                    onClick={() => setOpenGroupId((id) => (id === item.id ? null : item.id))}
                    className={`flex min-h-11 w-full items-center justify-between border-l-2 py-2 pr-2 pl-3 font-body text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-secondary-400 ${
                      isGroupActive(item) ? "border-secondary-400 text-foreground" : "border-transparent text-foreground"
                    }`}
                  >
                    {item.label}
                    <Chevron open={isOpen} />
                  </button>
                  {isOpen && (
                    <div id={`mobile-group-${item.id}`} className="flex flex-col pb-2">
                      {item.children.map((child) => renderLink(child, mobileLinkClass(isPathActive(child), true), closeAll))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
