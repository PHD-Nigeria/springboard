import { notFound } from "next/navigation";
import { getStaffBySlug } from "@/lib/content/queries";

/** Placeholder — no visual design yet. */
export default async function StaffPage({
  params,
}: {
  params: Promise<{ staffSlug: string }>;
}) {
  const { staffSlug } = await params;
  const staff = await getStaffBySlug(staffSlug);
  if (!staff) notFound();

  return (
    <article>
      <h1>{staff.full_name}</h1>
      {staff.title ? <p>{staff.title}</p> : null}
    </article>
  );
}
