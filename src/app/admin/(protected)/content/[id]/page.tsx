import { notFound } from "next/navigation";
import {
  getContentById,
  listAuthors,
  listCategories,
  listPublications,
  listSections,
  listStaff,
  getSpotlightByContentId,
  getContentStaffIds,
} from "@/lib/admin/queries";
import { listContentRevisionsAction } from "@/lib/admin/content-actions";
import { resolveBodyReferences } from "@/lib/content/resolve-body-references";
import { createClient } from "@/lib/supabase/server";
import { getPublicUrl } from "@/lib/storage/buckets";
import { ContentForm } from "@/components/admin/ContentForm";
import { SpotlightForm } from "@/components/admin/SpotlightForm";
import { BirthdayForm } from "@/components/admin/BirthdayForm";
import { AdminPageHeader } from "@/components/admin/ui";

const REVISIONED_TYPES = ["ARTICLE", "COMPANY_NEWS"];

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [content, authors, categories, publications, sections] = await Promise.all([
    getContentById(id),
    listAuthors(),
    listCategories(),
    listPublications(),
    listSections(),
  ]);

  if (!content) notFound();

  // STAFF_SPOTLIGHT and BIRTHDAY are built and edited entirely through
  // their own dedicated forms (real staff_id + Q&A/content_staff data, not
  // the block-editor body every other type uses), see ContentForm's own
  // comment on why they're excluded from its CREATABLE_TYPES.
  if (content.content_type === "STAFF_SPOTLIGHT") {
    const [staff, spotlight] = await Promise.all([listStaff(), getSpotlightByContentId(id)]);
    const supabase = await createClient();
    const initialCover = content.content_cover_media
      ? {
          id: content.content_cover_media.id,
          url: content.content_cover_media.bucket === "public" ? getPublicUrl(supabase, content.content_cover_media.storage_path) : null,
          alt_text: content.content_cover_media.alt_text,
        }
      : null;
    return (
      <div>
        <AdminPageHeader title={`Edit: ${content.title}`} />
        <SpotlightForm
          content={content}
          staffOptions={staff}
          categoryId={content.category_id}
          initialStaffId={spotlight?.staffId ?? null}
          initialQuestions={spotlight?.questions ?? []}
          initialCover={initialCover}
        />
      </div>
    );
  }

  if (content.content_type === "BIRTHDAY") {
    const [staff, staffIds] = await Promise.all([listStaff(), getContentStaffIds(id)]);
    const supabase = await createClient();
    const initialCover = content.content_cover_media
      ? {
          id: content.content_cover_media.id,
          url: content.content_cover_media.bucket === "public" ? getPublicUrl(supabase, content.content_cover_media.storage_path) : null,
          alt_text: content.content_cover_media.alt_text,
        }
      : null;
    return (
      <div>
        <AdminPageHeader title={`Edit: ${content.title}`} />
        <BirthdayForm content={content} staffOptions={staff} categoryId={content.category_id} initialStaffId={staffIds[0] ?? null} initialCover={initialCover} />
      </div>
    );
  }

  const revisions = REVISIONED_TYPES.includes(content.content_type)
    ? await listContentRevisionsAction(id)
    : undefined;

  const supabase = await createClient();
  const { mediaMap } = await resolveBodyReferences(supabase, {
    version: 1,
    blocks: Array.isArray((content.body as { blocks?: unknown })?.blocks)
      ? (content.body as { blocks: import("@/content-types/blocks").Block[] }).blocks
      : [],
  });
  const initialMediaById = Object.fromEntries(
    Object.entries(mediaMap).map(([mediaId, media]) => [mediaId, { url: media.url, alt_text: media.alt ?? null }])
  );

  const initialCover = content.content_cover_media
    ? {
        id: content.content_cover_media.id,
        url:
          content.content_cover_media.bucket === "public"
            ? getPublicUrl(supabase, content.content_cover_media.storage_path)
            : null,
        alt_text: content.content_cover_media.alt_text,
      }
    : null;

  return (
    <div>
      <AdminPageHeader title={`Edit: ${content.title}`} />
      <ContentForm
        content={content}
        authors={authors.map((a) => ({ id: a.id, label: a.name }))}
        categories={categories.map((c) => ({ id: c.id, label: c.name }))}
        publications={publications.map((p) => ({ id: p.id, label: p.title }))}
        sections={sections.map((s) => ({ id: s.id, label: s.title, publicationId: s.publication_id }))}
        initialMediaById={initialMediaById}
        initialCover={initialCover}
        revisions={revisions}
      />
    </div>
  );
}
