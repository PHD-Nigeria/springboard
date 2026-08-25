import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";

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

  return (
    <div className="min-h-screen bg-background">
      <AdminNav session={session} />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
