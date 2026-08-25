import Link from "next/link";
import Image from "next/image";
import { listAuthors } from "@/lib/admin/queries";
import { AdminPageHeader } from "@/components/admin/ui";

export default async function AdminContributorsPage() {
  const authors = await listAuthors();

  return (
    <div>
      <AdminPageHeader
        title="Contributors"
        description={`${authors.length} contributor${authors.length === 1 ? "" : "s"}`}
        actions={
          <Link
            href="/admin/contributors/new"
            className="border border-secondary-400 bg-secondary-400 px-4 py-2 font-body text-sm font-medium text-primary-900 hover:bg-secondary-300"
          >
            New contributor
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {authors.map((author) => (
          <Link
            key={author.id}
            href={`/admin/contributors/${author.id}`}
            className="block border border-border p-3 text-center hover:border-secondary-400"
          >
            <div className="relative mx-auto mb-3 aspect-square w-16 overflow-hidden rounded-full bg-surface">
              {author.avatarUrl ? (
                <Image src={author.avatarUrl} alt={author.name} fill sizes="64px" className="object-cover" />
              ) : null}
            </div>
            <p className="truncate font-body text-sm text-foreground">{author.name}</p>
            {author.title && <p className="truncate font-body text-xs text-foreground-muted">{author.title}</p>}
            <p className="truncate font-body text-xs text-foreground-muted">
              {author.articleCount} {author.articleCount === 1 ? "article" : "articles"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
