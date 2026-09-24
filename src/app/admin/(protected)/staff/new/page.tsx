import { StaffForm } from "@/components/admin/StaffForm";
import { AdminPageHeader } from "@/components/admin/ui";

export default function NewStaffPage() {
  return (
    <div>
      <AdminPageHeader title="New staff member" />
      <StaffForm staff={null} />
    </div>
  );
}
