"use client";

import { useState } from "react";
import { YouTubeEmbed } from "@/components/blocks/YouTubeEmbed";
import { youTubeThumbnailUrl } from "@/lib/video/youtube";

export interface FeaturedVideoItem {
  videoId: string;
  title: string;
  caption: string | null;
  orientation: "landscape" | "portrait";
  editionCode: string | null;
  editionTitle: string | null;
}

/**
 * The homepage's lead video. `videos[0]` is the initial pick (chosen on the
 * server); the rest are selectable. Each keeps its native ratio because the
 * actual player is the existing YouTubeEmbed (16:9, or 9:16 capped to the
 * viewport height). Keying the embed by id remounts it on every switch, so a
 * newly chosen video always shows its poster and never autoplays.
 * The posters are YouTube's own images, loaded by the visitor's browser with
 * no referrer; the player itself (youtube-nocookie.com) only mounts on click.
 */
export function FeaturedVideoPanel({ videos }: { videos: FeaturedVideoItem[] }) {
  const [selectedId, setSelectedId] = useState(videos[0]?.videoId);
  const current = videos.find((v) => v.videoId === selectedId) ?? videos[0];
  if (!current) return null;

  const thumb = youTubeThumbnailUrl(current.videoId);
  return (
    <article aria-labelledby="featured-video-title" className="border border-border bg-surface" data-testid="featured-video" data-video-id={current.videoId} data-orientation={current.orientation}>
      <div className={current.orientation === "portrait" ? "bg-surface-raised pt-4" : ""}>
        <YouTubeEmbed
          key={current.videoId}
          videoId={current.videoId}
          title={current.title}
          caption={current.caption ?? undefined}
          orientation={current.orientation}
          compact
          thumbnail={thumb ? { url: thumb, external: true } : undefined}
        />
      </div>
      <div className="px-4 pt-3 pb-4">
        <p className="font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
          Featured video{current.editionCode ? ` · ${current.editionCode}` : ""}
        </p>
        <h2 id="featured-video-title" className="mt-1 font-display text-xl leading-tight font-semibold text-foreground">
          {current.title}
        </h2>
        {videos.length > 1 && (
          <ul aria-label="Choose a featured video" className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
            {videos.map((v) => {
              const t = youTubeThumbnailUrl(v.videoId);
              const pressed = v.videoId === current.videoId;
              return (
                <li key={v.videoId}>
                  <button
                    type="button"
                    data-video-id={v.videoId}
                    aria-pressed={pressed}
                    onClick={() => setSelectedId(v.videoId)}
                    className={`flex min-h-11 items-center gap-2 border py-1 pr-3 pl-1 text-left font-body text-sm text-foreground ${
                      pressed ? "border-primary-900 bg-surface-raised shadow-[inset_3px_0_0_var(--color-secondary-400)]" : "border-border bg-surface hover:bg-surface-raised"
                    }`}
                  >
                    {t ? (
                      // eslint-disable-next-line @next/next/no-img-element -- third-party poster, no referrer
                      <img src={t} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-[30px] w-10 object-cover" />
                    ) : null}
                    <span>
                      <span className="block font-semibold">{v.title}</span>
                      <span className="block text-xs text-foreground-muted">{v.orientation === "portrait" ? "Vertical" : "Landscape"}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </article>
  );
}
