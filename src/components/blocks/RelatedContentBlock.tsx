import Link from "next/link";
import type { RelatedContentBlock as RelatedContentBlockData } from "@/content-types/blocks";

interface ResolvedRelatedContent {
  id: string;
  title: string;
  href: string;
}

export function RelatedContentBlock({
  block,
  items,
}: {
  block: RelatedContentBlockData;
  items: ResolvedRelatedContent[];
}) {
  const resolved = items.filter((item) => block.contentIds.includes(item.id));
  if (resolved.length === 0) return null; // soft-fail if none resolved

  return (
    <nav aria-label="Related content">
      <ul>
        {resolved.map((item) => (
          <li key={item.id}>
            <Link href={item.href}>{item.title}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
