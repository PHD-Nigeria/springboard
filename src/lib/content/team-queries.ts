import { createClient } from "@/lib/supabase/server";
import { isMissingRelationError } from "@/lib/team/team";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  displayOrder: number;
  isVisible: boolean;
}

/**
 * Members shown on the homepage, in the order the CMS gives them. RLS limits an anonymous visitor to visible rows,
 * and the explicit filter keeps a signed-in editor's homepage identical to a visitor's. If the team_members table
 * does not exist yet (migration not applied), the section is simply absent: the homepage never errors because of it.
 */
export async function getVisibleTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_members")
    .select("id, name, role, display_order, is_visible")
    .eq("is_visible", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, role: row.role, displayOrder: row.display_order, isVisible: row.is_visible }));
}

/** Every member including hidden ones, for /admin/team. Returns null when the table is missing, so the screen can explain that instead of failing. */
export async function getAllTeamMembersForAdmin(): Promise<TeamMember[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_members")
    .select("id, name, role, display_order, is_visible")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, role: row.role, displayOrder: row.display_order, isVisible: row.is_visible }));
}
