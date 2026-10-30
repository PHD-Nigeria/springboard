"use client";

import { useState } from "react";
import Image from "next/image";
import { YouTubeEmbed } from "@/components/blocks/YouTubeEmbed";

export interface FeaturedVideoItem {
  videoId: string;
  title: string;
  caption: string | null;
  orientation: "landscape" | "portrait";
  editionCode: string | null;
  editionTitle: string | null;
  /** A public Media Library image chosen by the editor, or null for the neutral branded fallback. Never a YouTube image. */
  thumbnailUrl: string | null;
}

/**
 * The homepage's lead video. `videos[0]` is the initial pick (chosen on the
 * server); the rest are selectable. Each keeps its native ratio because the
 * actual player is the existing YouTubeEmbed (16:9, or 9:16 capped to the
 * viewport height). Keying the embed by id remounts it on every switch, so a
 * newly chosen video always shows its poster and never autoplays.
 *
 * Privacy: NOTHING is requested from YouTube or Google until the visitor
 * presses play. The poster is the editor's own Media Library thumbnail, or —
 * when none is set — a neutral branded panel (the dark facade with its play
 * button). Only on click does the youtube-nocookie.com player mount.
 */
export function FeaturedVideoPanel({ videos }: { videos: FeaturedVideoItem[] }) {
  const [selectedId, setSelectedId] = useState(videos[0]?.videoId);
  const current = videos.find((v) => v.videoId === selectedId) ?? videos[0];
  if (!current) return null;

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
          thumbnail={current.thumbnailUrl ? { url: current.thumbnailUrl } : undefined}
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
                    {v.thumbnailUrl ? (
                      <Image data-thumb="media" src={v.thumbnailUrl} alt="" width={40} height={30} sizes="40px" className="h-[30px] w-10 object-cover" />
                    ) : (
                      <span data-thumb="fallback" aria-hidden="true" className="flex h-[30px] w-10 items-center justify-center bg-primary-900 text-white">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                    )}
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
