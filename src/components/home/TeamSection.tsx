import type { TeamMember } from "@/lib/content/team-queries";

/** Editorial team at the foot of the homepage. Data comes from the CMS (team_members); nothing here is hardcoded. Renders nothing when there is no visible member. */
export function TeamSection({ members }: { members: TeamMember[] }) {
  if (members.length === 0) return null;
  return (
    <section id="team" aria-labelledby="team-heading" className="mx-auto max-w-6xl px-gutter py-section-md">
      <h2 id="team-heading" className="mb-10 border-b border-border pb-4 font-body text-sm font-medium tracking-wide text-foreground-muted uppercase">
        The Springboard Team
      </h2>
      <ul className="grid grid-cols-2 gap-x-10 gap-y-8 md:grid-cols-3 lg:grid-cols-5">
        {members.map((member) => (
          <li key={member.id}>
            <p className="font-display text-lg font-semibold text-foreground">{member.name}</p>
            <p className="mt-1 font-body text-sm text-foreground-muted">{member.role}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
