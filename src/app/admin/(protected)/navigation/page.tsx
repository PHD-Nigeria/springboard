import { getNavItems } from "@/lib/admin/queries";
import { NavigationManager } from "@/components/admin/NavigationManager";
import { AdminPageHeader } from "@/components/admin/ui";

export default async function AdminNavigationPage() {
  const items = await getNavItems();

  return (
    <div>
      <AdminPageHeader title="Navigation" description="The public header's links, in the order they appear." />
      <NavigationManager initialItems={items} />
    </div>
  );
}
