import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { getAllTeamMembersForAdmin } from "@/lib/content/team-queries";
import { TeamManager } from "@/components/admin/TeamManager";
import { AdminPageHeader, AdminNotice } from "@/components/admin/ui";

export default async function AdminTeamPage() {
  const session = await getAdminSession();
  // Admin-only. Not the security boundary: team_members_write RLS (is_admin()) enforces it independently.
  if (!session || session.role !== "admin") redirect("/admin");

  const members = await getAllTeamMembersForAdmin();

  return (
    <div>
      <AdminPageHeader title="Team" description="The people shown in the homepage team section. Add, edit, reorder, hide or remove them here." />
      {members === null ? (
        <AdminNotice tone="info">The team table has not been set up in this environment yet. Apply the team_members migration first; nothing is lost and the homepage simply shows no team section until then.</AdminNotice>
      ) : (
        <TeamManager members={members} />
      )}
    </div>
  );
}
