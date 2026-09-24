import Link from "next/link";
import Image from "next/image";
import { listStaff } from "@/lib/admin/queries";
import { AdminPageHeader } from "@/components/admin/ui";

export default async function AdminStaffPage() {
  const staff = await listStaff();

  return (
    <div>
      <AdminPageHeader
        title="Staff"
        description={`${staff.length} staff member${staff.length === 1 ? "" : "s"}, the employee directory Staff Spotlight and Staff News/Birthday content draw from.`}
        actions={
          <Link
            href="/admin/staff/new"
            className="border border-secondary-400 bg-secondary-400 px-4 py-2 font-body text-sm font-medium text-primary-900 hover:bg-secondary-300"
          >
            New staff member
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {staff.map((person) => (
          <Link
            key={person.id}
            href={`/admin/staff/${person.id}`}
            className="block border border-border p-3 text-center hover:border-secondary-400"
          >
            <div className="relative mx-auto mb-3 aspect-square w-16 overflow-hidden rounded-full bg-surface">
              {person.photoUrl ? (
                <Image src={person.photoUrl} alt={person.full_name} fill sizes="64px" className="object-cover" />
              ) : null}
            </div>
            <p className="truncate font-body text-sm text-foreground">
              {person.full_name}
              {!person.is_active && <span className="ml-1 text-foreground-muted">(inactive)</span>}
            </p>
            {person.title && <p className="truncate font-body text-xs text-foreground-muted">{person.title}</p>}
          </Link>
        ))}
        {staff.length === 0 && (
          <p className="col-span-full p-6 font-body text-sm text-foreground-muted">
            No staff yet, add one before creating a Staff Spotlight or Birthday.
          </p>
        )}
      </div>
    </div>
  );
}
