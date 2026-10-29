import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader, AdminEmptyState, AdminNotice, StatusBadge } from "@/components/admin/ui";
import { youTubeWatchUrl } from "@/lib/video/youtube";
import { CONTENT_TYPE_LABELS, type ContentType } from "@/content-types/types";

interface VideoRow {
  id: string;
  title: string;
  status: string;
  content_type: ContentType;
  updated_at: string;
  body: unknown;
  content_publication: { title: string } | null;
}

interface VideoBlockView {
  videoId: string | null;
  title: string;
  orientation: string;
}

/** Read-only: videos live inside story bodies as Video blocks, so this lists them by story. Nothing is created here. */
function videoBlocks(body: unknown): VideoBlockView[] {
  const blocks = (body as { blocks?: unknown } | null)?.blocks;
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b): b is Record<string, unknown> => Boolean(b) && typeof b === "object" && (b as { type?: unknown }).type === "video")
    .map((b) => ({
      videoId: typeof b.videoId === "string" ? b.videoId : null,
      title: typeof b.title === "string" && b.title ? b.title : typeof b.caption === "string" && b.caption ? b.caption : "Untitled video",
      orientation: b.orientation === "portrait" ? "Portrait" : "Landscape",
    }));
}

export default async function AdminVideosPage() {
  const supabase = await createClient();
  // jsonb containment: stories whose body has at least one block of type "video". RLS still limits what this session can see.
  const { data, error } = await supabase
    .from("content")
    .select("id, title, status, content_type, updated_at, body, content_publication:publication_id ( title )")
    .contains("body", { blocks: [{ type: "video" }] })
    .order("updated_at", { ascending: false })
    .limit(100)
    .returns<VideoRow[]>();

  return (
    <div>
      <AdminPageHeader title="Videos" description="Videos used in stories. Add or change a video from the story's Video block." />
      <AdminNotice tone="info" className="mb-5">
        Springboard plays YouTube videos only. Paste the YouTube link the editorial team provides into a Video block in the story editor; there is no separate video upload.
      </AdminNotice>
      {error ? (
        <AdminNotice tone="error">The video list could not be loaded. Try again, and tell an administrator if it keeps happening.</AdminNotice>
      ) : !data || data.length === 0 ? (
        <AdminEmptyState title="No stories contain a video yet">Add a Video block to a story to see it here.</AdminEmptyState>
      ) : (
        <div className="border border-border bg-surface">
          <ul>
            {data.flatMap((row) =>
              videoBlocks(row.body).map((video, index) => {
                const watch = video.videoId ? youTubeWatchUrl(video.videoId) : null;
                return (
                  <li key={`${row.id}-${index}`} className="grid grid-cols-1 items-center gap-x-4 gap-y-1 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_8rem_9rem_auto]">
                    <div className="min-w-0">
                      <p className="truncate font-body text-sm font-semibold text-foreground">{video.title}</p>
                      <p className="truncate font-body text-xs text-foreground-muted">
                        In <Link href={`/admin/content/${row.id}`} className="text-primary-600 underline">{row.title}</Link> · {CONTENT_TYPE_LABELS[row.content_type]} · {row.content_publication?.title ?? "No edition assigned"}
                      </p>
                    </div>
                    <span className="font-body text-xs text-foreground-muted">{video.videoId ? video.orientation : "Older video format"}</span>
                    <div>
                      <StatusBadge status={row.status} />
                    </div>
                    {watch ? (
                      <a href={watch} target="_blank" rel="noopener noreferrer" className="font-body text-sm text-primary-600 underline underline-offset-2">
                        Open on YouTube<span className="sr-only"> (new tab)</span>
                      </a>
                    ) : (
                      <span className="font-body text-xs text-foreground-muted">No YouTube link stored</span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
