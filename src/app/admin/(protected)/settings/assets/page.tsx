import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/admin/queries";
import { AdminPageHeader } from "@/components/admin/ui";
import { SiteAssetsForm } from "@/components/admin/SiteAssetsForm";

export default async function AdminSiteAssetsPage() {
  const session = await getAdminSession();
  // Admin-only (§16 of the brief: Site Assets is listed only under ADMIN),
  // matching the same pattern /admin/users uses — a UX-convenience redirect
  // here, RLS (site_settings_write) is what actually enforces it.
  if (!session || session.role !== "admin") redirect("/admin/settings");

  const settings = await getSiteSettings();

  return (
    <div>
      <AdminPageHeader
        title="Site Assets"
        description="Approved PHD/Springboard brand assets, managed through the Media Library."
        actions={
          <Link href="/admin/settings" className="font-body text-sm text-foreground-muted hover:text-secondary-400">
            ← Back to Settings
          </Link>
        }
      />
      <SiteAssetsForm
        logoPhd={settings.logoPhd}
        logoSpringboard={settings.logoSpringboard}
        favicon={settings.favicon}
        ogImage={settings.ogImage}
        homepageArtwork={settings.homepageArtwork}
      />
    </div>
  );
}
