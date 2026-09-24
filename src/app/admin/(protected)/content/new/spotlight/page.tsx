import { listStaff, listCategories } from "@/lib/admin/queries";
import { SpotlightForm } from "@/components/admin/SpotlightForm";
import { AdminPageHeader } from "@/components/admin/ui";

export default async function NewSpotlightPage() {
  const [staff, categories] = await Promise.all([listStaff(), listCategories()]);
  const category = categories.find((c) => c.slug === "staff-spotlight") ?? null;

  return (
    <div>
      <AdminPageHeader title="New Staff Spotlight" description="Profile one staff member with a photo and a set of questions and answers." />
      <SpotlightForm
        content={null}
        staffOptions={staff}
        categoryId={category?.id ?? null}
        initialStaffId={null}
        initialQuestions={[]}
        initialCover={null}
      />
    </div>
  );
}
