import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { MediaBatchImport } from "@/components/admin/MediaBatchImport";
import { AdminPageHeader } from "@/components/admin/ui";

/**
 * TEMPORARY one-time tool — remove this route and MediaBatchImport.tsx once
 * the initial image import is done. Administrators only: the page itself
 * redirects everyone else, and every upload it performs still goes through
 * the normal authorised upload actions (RLS, MIME and size checks, audit log).
 */
export default async function BatchImportPage() {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") redirect("/admin");

  return (
    <div>
      <AdminPageHeader
        title="Batch image import (temporary)"
        description="Upload a folder of images to the Media Library. Everything uploads as private — nothing is public until an administrator promotes each image."
      />
      <MediaBatchImport />
    </div>
  );
}
