import { listCategories } from "@/lib/admin/queries";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { AdminPageHeader } from "@/components/admin/ui";

export default async function AdminCategoriesPage() {
  const categories = await listCategories();

  return (
    <div>
      <AdminPageHeader title="Categories" description="The taxonomy content is tagged with — colours stay controlled by the design system, not chosen here." />
      <CategoryManager initialCategories={categories} />
    </div>
  );
}
