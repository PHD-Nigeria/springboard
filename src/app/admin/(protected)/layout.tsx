import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { getReviewQueueCount } from "@/lib/admin/queries";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import "@/components/admin/admin-theme.css";

/**
 * Gates every /admin route except /admin/login. This redirect is a UX
 * convenience, not the security boundary — every mutation below still runs
 * through the cookie-based (RLS-subject) Supabase client, so RLS is what
 * actually stops an unauthorized write even if this check were somehow
 * bypassed.
 */
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  // Contributors never see the review queue entry, so the count is only fetched for roles that can act on it.
  const reviewCount = session.role === "contributor" ? 0 : await getReviewQueueCount();

  return (
    <div className="admin-theme min-h-screen bg-background text-foreground lg:flex">
      <AdminSidebar session={{ email: session.email, role: session.role }} reviewCount={reviewCount} />
      <div className="min-w-0 flex-1">
        <nav aria-label="Skip links">
          <a href="#admin-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-secondary-400 focus:px-3 focus:py-2 focus:text-primary-900">
            Skip to main content
          </a>
        </nav>
        <main id="admin-main" className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
