import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { listUsers } from "@/lib/admin/queries";
import { UserManager } from "@/components/admin/UserManager";
import { AdminPageHeader } from "@/components/admin/ui";

export default async function AdminUsersPage() {
  const session = await getAdminSession();
  // The (protected) layout already requires contributor+ to reach any
  // /admin route at all; user management is narrower than that and needs
  // its own explicit admin-only gate on top. Not the real security boundary
  // either way — list_profiles_with_email() and profiles' RLS/trigger both
  // enforce is_admin() independently of this check.
  if (!session || session.role !== "admin") redirect("/admin");

  const users = await listUsers();

  return (
    <div>
      <AdminPageHeader title="Users" description="Manage Springboard admin accounts and roles." />
      <UserManager initialUsers={users} currentUserId={session.userId} />
    </div>
  );
}
