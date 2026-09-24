import { listStaff, listCategories } from "@/lib/admin/queries";
import { BirthdayForm } from "@/components/admin/BirthdayForm";
import { AdminPageHeader } from "@/components/admin/ui";

export default async function NewBirthdayPage() {
  const [staff, categories] = await Promise.all([listStaff(), listCategories()]);
  const category = categories.find((c) => c.slug === "staff-news") ?? null;

  return (
    <div>
      <AdminPageHeader title="New Staff News / Birthday" description="Add one birthday card, with the person's photo." />
      <BirthdayForm content={null} staffOptions={staff} categoryId={category?.id ?? null} initialStaffId={null} initialCover={null} />
    </div>
  );
}
