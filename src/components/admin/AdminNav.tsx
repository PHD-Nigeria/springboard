"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/lib/admin/auth-actions";
import type { AdminSession } from "@/lib/auth/session";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Content", href: "/admin/content" },
  { label: "Media", href: "/admin/media" },
  { label: "Contributors", href: "/admin/contributors" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Sections", href: "/admin/sections" },
  { label: "Publications", href: "/admin/publications" },
  { label: "Navigation", href: "/admin/navigation", hideForContributor: true },
  { label: "Activity", href: "/admin/activity", hideForContributor: true },
  { label: "Users", href: "/admin/users", adminOnly: true },
  { label: "Settings", href: "/admin/settings" },
];

export function AdminNav({ session }: { session: AdminSession }) {
  const pathname = usePathname();
  // Nav visibility is UX polish, not the security boundary — /admin/users
  // and /admin/activity both re-check session.role server-side, and
  // RLS/the SECURITY DEFINER functions they call enforce the real
  // restriction independently of both.
  const visibleItems = NAV_ITEMS.filter(
    (item) => (!item.adminOnly || session.role === "admin") && (!item.hideForContributor || session.role !== "contributor")
  );

  return (
    <header className="border-b border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href="/admin" className="font-display text-lg font-semibold tracking-wide text-foreground">
            SPRINGBOARD <span className="text-foreground-muted">Admin</span>
          </Link>
          <nav aria-label="Admin" className="flex flex-wrap gap-1">
            {visibleItems.map((item) => {
              const isActive = item.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`px-3 py-1.5 font-body text-sm transition-colors duration-fast hover:text-secondary-400 ${
                    isActive ? "border border-border text-foreground" : "text-foreground-muted"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="font-body text-xs text-foreground-muted">
            {session.email} · {session.role}
          </span>
          <form action={signOutAction}>
            <button type="submit" className="font-body text-sm text-foreground-muted hover:text-secondary-400">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
