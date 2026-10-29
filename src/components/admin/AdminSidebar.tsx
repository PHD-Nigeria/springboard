"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOutAction } from "@/lib/admin/auth-actions";
import type { AdminSession } from "@/lib/auth/session";
import { ADMIN_NAV_GROUPS, isNavItemVisible, isNavItemActive } from "@/components/admin/admin-nav-config";

interface SidebarProps {
  session: Pick<AdminSession, "email" | "role">;
  reviewCount: number;
}

function Brand() {
  return (
    <Link href="/admin" className="admin-chrome flex items-center gap-2 font-display text-lg font-bold tracking-wide text-white">
      <span aria-hidden="true" className="inline-block h-2.5 w-2.5 bg-secondary-400" />
      Springboard
      <span className="font-body text-xs font-medium text-primary-100">Admin</span>
    </Link>
  );
}

function NavBody({
  session,
  reviewCount,
  scope,
  onNavigate,
}: SidebarProps & { scope: string | null; onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  return (
    <>
      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-2 pb-4">
        {ADMIN_NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => isNavItemVisible(item, session.role));
          if (items.length === 0) return null;
          return (
            <section key={group.label} aria-labelledby={`nav-${group.label}`} className="mt-5 first:mt-2">
              <h2 id={`nav-${group.label}`} className="px-3 pb-1 font-body text-[11px] font-semibold tracking-[0.08em] text-primary-100 uppercase">
                {group.label}
              </h2>
              <ul>
                {items.map((item) => {
                  const active = isNavItemActive(item, pathname, scope);
                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={`admin-chrome flex items-center justify-between gap-2 border-l-[3px] px-3 py-1.5 font-body text-sm transition-colors duration-fast ${
                          active
                            ? "border-secondary-400 bg-white/15 font-semibold text-white"
                            : "border-transparent text-primary-50 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span>{item.label}</span>
                        {item.badge === "review" && reviewCount > 0 && (
                          <span className="bg-secondary-400 px-1.5 py-0.5 font-body text-[11px] leading-none font-bold text-primary-900">
                            <span className="sr-only">{reviewCount} waiting: </span>
                            {reviewCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </nav>
      <div className="border-t border-white/20 px-4 py-3">
        <p className="truncate font-body text-xs text-primary-100" title={session.email ?? undefined}>
          {session.email}
        </p>
        <p className="font-body text-xs font-semibold text-white capitalize">{session.role}</p>
        <form action={signOutAction} className="mt-2">
          <button type="submit" className="admin-chrome font-body text-sm text-primary-50 underline underline-offset-2 hover:text-white">
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}

function SidebarWithParams(props: SidebarProps & { onNavigate?: () => void }) {
  const scope = useSearchParams().get("scope");
  return <NavBody {...props} scope={scope} />;
}

function Nav(props: SidebarProps & { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavBody {...props} scope={null} />}>
      <SidebarWithParams {...props} />
    </Suspense>
  );
}

export function AdminSidebar(props: SidebarProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Desktop and tablet: persistent sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col admin-bg-deep lg:flex" aria-label="Admin sidebar">
        <div className="px-4 py-4">
          <Brand />
        </div>
        <Nav {...props} />
      </aside>

      {/* Below lg: top bar and slide-over */}
      <header className="sticky top-0 z-40 flex items-center justify-between admin-bg-deep px-4 py-2.5 lg:hidden">
        <Brand />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="admin-drawer"
          onClick={() => setOpen((value) => !value)}
          className="admin-chrome border border-white/40 px-3 py-1.5 font-body text-sm font-medium text-white"
        >
          {open ? "Close" : "Menu"}
          {!open && props.reviewCount > 0 && props.session.role !== "contributor" && (
            <span className="sr-only"> ({props.reviewCount} waiting for review)</span>
          )}
        </button>
      </header>
      {open && (
        <div className="fixed inset-x-0 top-[52px] bottom-0 z-30 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-[#1a0b3b]/60" onClick={() => setOpen(false)} />
          <div id="admin-drawer" className="relative flex h-full w-[min(20rem,85vw)] flex-col admin-bg-deep">
            <Nav {...props} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
