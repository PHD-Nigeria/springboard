import Link from "next/link";
import { getAdminSession } from "@/lib/auth/session";
import { signOutAction } from "@/lib/admin/auth-actions";
import { getSiteSettings, listPublications, listAuthors } from "@/lib/admin/queries";
import { AdminButton, AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { HomepageConfigForm } from "@/components/admin/HomepageConfigForm";

export default async function AdminSettingsPage() {
  const [session, settings, publications, authors] = await Promise.all([
    getAdminSession(),
    getSiteSettings(),
    listPublications(),
    listAuthors(),
  ]);
  const isAdmin = session?.role === "admin";

  return (
    <div>
      <AdminPageHeader
        title="Settings"
        actions={
          isAdmin ? (
            <Link
              href="/admin/settings/assets"
              className="border border-border px-4 py-2 font-body text-sm font-medium text-foreground hover:border-secondary-400"
            >
              Site Assets →
            </Link>
          ) : undefined
        }
      />
      <div className="space-y-6">
        <AdminCard className="max-w-md">
          <p className="font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">Signed in as</p>
          <p className="mt-1 font-body text-sm text-foreground">{session?.email}</p>
          <p className="mt-4 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">Role</p>
          <p className="mt-1 font-body text-sm text-foreground capitalize">{session?.role}</p>

          <form action={signOutAction} className="mt-6">
            <AdminButton type="submit" variant="secondary">
              Sign out
            </AdminButton>
          </form>
        </AdminCard>

        <SettingsForm
          defaultPublicationId={settings.defaultPublicationId}
          publications={publications.map((p) => ({ id: p.id, title: p.title }))}
          isAdmin={isAdmin}
        />

        <HomepageConfigForm
          featuredContentId={settings.featuredContentId}
          featuredContentTitle={settings.featuredContentTitle}
          featuredAuthorNames={settings.featuredAuthorNames}
          bannerTitle={settings.bannerTitle}
          bannerDescription={settings.bannerDescription}
          siteTitle={settings.siteTitle}
          seoDefaultDescription={settings.seoDefaultDescription}
          authors={authors.map((a) => ({ id: a.id, name: a.name }))}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
