import type { AdminSession } from "@/lib/auth/session";

type Role = AdminSession["role"];

export interface AdminNavItem {
  label: string;
  href: string;
  /** Visible only to these roles. Omitted means every signed-in staff role. */
  roles?: Role[];
  badge?: "review";
  /** Items that differ from a sibling only by query string or hash. */
  match?: { scope?: string; exact?: boolean; hashOnly?: boolean };
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/**
 * Hiding an item is usability only. Every destination re-checks the role on the
 * server and RLS enforces the real permission, exactly as before.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { label: "Overview", href: "/admin", match: { exact: true } },
      { label: "My work", href: "/admin/content?scope=mine", match: { scope: "mine" } },
      { label: "Review queue", href: "/admin/review", roles: ["editor", "admin"], badge: "review" },
    ],
  },
  {
    label: "Publishing",
    items: [
      { label: "All content", href: "/admin/content", match: { scope: "all" } },
      { label: "New story", href: "/admin/content/new" },
      { label: "Editions / quarters", href: "/admin/publications" },
      { label: "Sections", href: "/admin/sections" },
      { label: "Categories", href: "/admin/categories" },
    ],
  },
  {
    label: "Media",
    items: [
      { label: "Media library", href: "/admin/media", match: { exact: true } },
      { label: "Upload media", href: "/admin/media#upload", match: { hashOnly: true } },
      { label: "Videos", href: "/admin/videos" },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Contributors", href: "/admin/contributors" },
      { label: "Staff", href: "/admin/staff" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Navigation and homepage settings", href: "/admin/navigation", roles: ["editor", "admin"] },
      { label: "Users and roles", href: "/admin/users", roles: ["admin"] },
      { label: "Activity log", href: "/admin/activity", roles: ["editor", "admin"] },
      { label: "Site settings", href: "/admin/settings" },
      { label: "User guide", href: "/admin/guide" },
    ],
  },
];

export function isNavItemVisible(item: AdminNavItem, role: Role): boolean {
  return !item.roles || item.roles.includes(role);
}

export function isNavItemActive(item: AdminNavItem, pathname: string, scope: string | null): boolean {
  if (item.match?.hashOnly) return false;
  const path = item.href.split(/[?#]/)[0];
  if (item.match?.scope === "mine") return pathname === "/admin/content" && scope === "mine";
  if (item.match?.scope === "all") return pathname === "/admin/content" && scope !== "mine";
  if (item.match?.exact) return pathname === path;
  // "New story" must not light up for every content edit page.
  if (path === "/admin/content/new") return pathname.startsWith("/admin/content/new");
  return pathname === path || pathname.startsWith(`${path}/`);
}
