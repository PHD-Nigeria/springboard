"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const FOOTER_LINKS = [
  { label: "Insights", href: "/#more-stories" },
  { label: "People", href: "/#people" },
  { label: "News", href: "/#news-bites" },
  { label: "Search", href: "/search" },
];

/** Branded footer — structural UI copy only, not editorial content. */
export function Footer() {
  const pathname = usePathname();
  // See Navigation.tsx's identical guard for why: /admin has its own chrome.
  if (pathname?.startsWith("/admin")) return null;

  return (
    <footer className="border-t border-primary-800 bg-primary-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-gutter py-20 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <p className="font-display text-2xl font-medium tracking-wide text-foreground">SPRINGBOARD</p>
          <p className="mt-4 font-body text-sm leading-relaxed text-foreground-muted">
            Springboard is PHD Nigeria&rsquo;s editorial platform — insights, people, and stories from
            across the agency.
          </p>
        </div>

        <nav aria-label="Footer" className="flex gap-8">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-body text-sm text-foreground-muted transition-colors duration-fast hover:text-secondary-400"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-primary-800 px-gutter py-6">
        <p className="mx-auto max-w-6xl font-body text-xs text-foreground-muted">
          &copy; {new Date().getFullYear()} PHD Nigeria. Springboard.
        </p>
      </div>
    </footer>
  );
}
