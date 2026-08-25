import { listMedia } from "@/lib/admin/queries";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { AdminPageHeader } from "@/components/admin/ui";

export default async function AdminMediaPage() {
  const media = await listMedia();

  return (
    <div>
      <AdminPageHeader title="Media Library" description="Upload and manage images used across Springboard." />
      <MediaLibrary initialMedia={media} />
    </div>
  );
}
