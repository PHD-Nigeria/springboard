"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { GuideEntry } from "@/lib/guide/content";
import type { GuideSearchDocument } from "@/lib/guide/search";
import { GuideSearch } from "@/components/guide/GuideSearch";

/**
 * The guide's chapter list + search, in one client component because both
 * need the current route (for the active-chapter highlight, same pattern
 * AdminNav.tsx already uses) and local UI state (the mobile
 * open/closed toggle, the search box). Everything it renders is static
 * navigation — no data fetching happens here.
 */
export function GuideSidebar({ chapters, searchDocuments }: { chapters: GuideEntry[]; searchDocuments: GuideSearchDocument[] }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => (href === "/admin/guide" ? pathname === "/admin/guide" : pathname === href);

  const linkClass = (href: string) =>
    `block border-l-2 px-3 py-2 font-body text-sm transition-colors duration-fast ${
      isActive(href)
        ? "border-secondary-400 bg-surface-raised text-foreground"
        : "border-transparent text-foreground-muted hover:border-border-strong hover:text-foreground"
    }`;

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen((open) => !open)}
        aria-expanded={mobileOpen}
        aria-controls="guide-sidebar"
        className="mb-4 flex w-full items-center justify-between border border-border bg-surface px-4 py-2.5 font-body text-sm font-medium text-foreground lg:hidden"
      >
        Guide contents
        <span aria-hidden="true">{mobileOpen ? "−" : "+"}</span>
      </button>

      <nav
        id="guide-sidebar"
        aria-label="Guide chapters"
        className={`${mobileOpen ? "block" : "hidden"} mb-8 w-full shrink-0 lg:sticky lg:top-8 lg:block lg:mb-0 lg:w-64`}
      >
        <div className="mb-4">
          <GuideSearch documents={searchDocuments} />
        </div>

        <Link href="/admin/guide" className={linkClass("/admin/guide")} onClick={() => setMobileOpen(false)}>
          Start Here
        </Link>

        <p className="mt-4 mb-1.5 px-3 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">Chapters</p>
        <ul>
          {chapters.map((chapter) => (
            <li key={chapter.href}>
              <Link href={chapter.href} className={linkClass(chapter.href)} onClick={() => setMobileOpen(false)}>
                {chapter.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
