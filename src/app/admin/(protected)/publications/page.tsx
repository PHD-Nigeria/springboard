import { listPublications } from "@/lib/admin/queries";
import { PublicationManager } from "@/components/admin/PublicationManager";
import { AdminPageHeader } from "@/components/admin/ui";

export default async function AdminPublicationsPage() {
  const publications = await listPublications();

  return (
    <div>
      <AdminPageHeader title="Publications" description="Issues that group sections and content together." />
      <PublicationManager initialPublications={publications} />
    </div>
  );
}
