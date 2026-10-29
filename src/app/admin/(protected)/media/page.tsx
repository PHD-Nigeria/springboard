import Link from "next/link";
import { listMedia } from "@/lib/admin/queries";
import { getAdminSession } from "@/lib/auth/session";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { AdminPageHeader } from "@/components/admin/ui";

export default async function AdminMediaPage() {
  const [media, session] = await Promise.all([listMedia(), getAdminSession()]);

  return (
    <div>
      <AdminPageHeader
        title="Media Library"
        description="Upload and manage images used across Springboard."
        actions={
          session?.role === "admin" ? (
            // Temporary: remove with the batch importer once the initial import is done.
            <Link
              href="/admin/media/batch-import"
              className="border border-border bg-surface px-4 py-2 font-body text-sm font-medium tracking-wide text-foreground hover:border-border-strong"
            >
              Batch import (temporary)
            </Link>
          ) : undefined
        }
      />
      <MediaLibrary initialMedia={media} />
    </div>
  );
}
