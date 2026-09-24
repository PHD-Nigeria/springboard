import { notFound } from "next/navigation";
import { getStaffById } from "@/lib/admin/queries";
import { StaffForm } from "@/components/admin/StaffForm";
import { AdminPageHeader } from "@/components/admin/ui";

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaffById(id);
  if (!staff) notFound();

  return (
    <div>
      <AdminPageHeader title={`Edit: ${staff.full_name}`} />
      <StaffForm staff={staff} />
    </div>
  );
}
