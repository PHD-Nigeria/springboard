"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { youTubeEmbedUrl, youTubeWatchUrl } from "@/lib/video/youtube";
import { isSignedStorageUrl } from "@/lib/storage/buckets";

interface YouTubeEmbedProps {
  videoId: string;
  title: string;
  caption?: string;
  orientation: "landscape" | "portrait";
  /** A public Media Library image chosen by the editor. Deliberately never YouTube's own thumbnail: that would contact Google before the visitor chose to play. */
  thumbnail?: { url: string; alt?: string };
}

/**
 * Click-to-play YouTube player. Nothing is requested from YouTube until the
 * visitor presses play: the facade is a button over an editor-chosen
 * thumbnail (or a plain panel), and only then is the privacy-enhanced
 * (youtube-nocookie.com) iframe mounted. Every URL here is rebuilt from the
 * validated id by lib/video/youtube.ts against a fixed host — no stored or
 * editor-supplied URL ever reaches the iframe. The "Watch on YouTube" link
 * stays visible so a deleted/private/embedding-disabled video still leads
 * somewhere useful instead of leaving a dead player.
 */
export function YouTubeEmbed({ videoId, title, caption, orientation, thumbnail }: YouTubeEmbedProps) {
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (playing) iframeRef.current?.focus();
  }, [playing]);

  const portrait = orientation === "portrait";
  const embedSrc = youTubeEmbedUrl(videoId, { autoplay: true });
  const watchHref = youTubeWatchUrl(videoId, portrait);
  if (!embedSrc || !watchHref) return null;

  return (
    <figure className={portrait ? "mx-auto w-full max-w-[min(22.5rem,calc(80svh*9/16))]" : "w-full"}>
      <div className={`relative overflow-hidden bg-primary-900 ${portrait ? "aspect-[9/16]" : "aspect-video"}`}>
        {playing ? (
          <iframe
            ref={iframeRef}
            src={embedSrc}
            title={title}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play video: ${title}`}
            className="group absolute inset-0 flex h-full w-full items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-secondary-400"
          >
            {thumbnail ? (
              <Image
                src={thumbnail.url}
                unoptimized={isSignedStorageUrl(thumbnail.url)}
                alt={thumbnail.alt ?? ""}
                fill
                sizes={portrait ? "360px" : "(min-width: 1024px) 672px, 100vw"}
                className="object-cover"
              />
            ) : null}
            <span aria-hidden="true" className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/20" />
            <span
              aria-hidden="true"
              className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-primary-900 transition-transform group-hover:scale-105"
            >
              <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-3 text-left font-body text-sm font-medium text-white">
              {title}
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-2 font-body text-sm text-foreground-muted">
        {caption ? <span className="block">{caption}</span> : null}
        <a href={watchHref} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
          Watch on YouTube
        </a>
        <span className="sr-only"> (opens in a new tab)</span>
      </figcaption>
    </figure>
  );
}
