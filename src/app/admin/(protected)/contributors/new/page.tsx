import { AuthorForm } from "@/components/admin/AuthorForm";
import { AdminPageHeader } from "@/components/admin/ui";

export default function NewContributorPage() {
  return (
    <div>
      <AdminPageHeader title="New contributor" />
      <AuthorForm author={null} />
    </div>
  );
}
