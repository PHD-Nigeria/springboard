"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { Block, VideoBlock } from "@/content-types/blocks";
import { AdminButton, AdminInput, AdminLabel, AdminSelect } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import type { AdminMediaRow } from "@/lib/admin/queries";
import { parseYouTubeUrl, youTubeWatchUrl } from "@/lib/video/youtube";
import { checkYouTubeVideoAction, type CheckYouTubeResult } from "@/lib/admin/video-actions";

const CHECK_MESSAGES = {
  not_embeddable_or_private:
    "YouTube says this video is private, or its owner has turned off embedding. It won't play on Springboard until that changes on YouTube.",
  not_found: "YouTube can't find this video — it may have been deleted or made private, or the link may be wrong.",
  unknown: "Couldn't reach YouTube to check this video just now. You can still save, then check again later.",
} as const;

/**
 * YouTube video fields for the block editor. The pasted link is parsed with
 * the same strict parser the server re-runs on save (lib/video/youtube.ts)
 * and only the 11-character video id is kept in the block — the link itself
 * is never stored. The check button only reads from YouTube; it never saves
 * anything or fills a field without the editor's click.
 */
export function VideoBlockFields({
  block,
  onChange,
  mediaById,
  onMediaResolved,
}: {
  block: VideoBlock;
  onChange: (next: Block) => void;
  mediaById: Record<string, { url: string | null; alt_text: string | null }>;
  onMediaResolved: (media: AdminMediaRow) => void;
}) {
  const fieldId = useId();
  const [url, setUrl] = useState(
    block.videoId ? (youTubeWatchUrl(block.videoId, block.orientation === "portrait") ?? "") : (block.externalUrl ?? "")
  );
  const [urlError, setUrlError] = useState<string | null>(null);
  const [check, setCheck] = useState<CheckYouTubeResult | null>(null);
  const [checking, startCheck] = useTransition();

  const parsed = parseYouTubeUrl(url);
  const urlRef = useRef<HTMLInputElement>(null);
  // An older block whose saved link isn't a supported YouTube link: it no longer displays, and saving is blocked until it is replaced.
  const unsupportedLegacy = !block.videoId && Boolean(block.externalUrl) && !parseYouTubeUrl(block.externalUrl);
  const current = block.thumbnailMediaId ? mediaById[block.thumbnailMediaId] : undefined;

  // Surface a bad link through the browser's own form validation, so Save is blocked *before* a server round-trip —
  // a refused save would otherwise reset the surrounding form's text fields (React resets a form after every action).
  const urlProblem =
    urlError ??
    (unsupportedLegacy
      ? "This block holds an older link that isn't a supported YouTube link. Paste a YouTube link, or remove the block."
      : null);
  useEffect(() => {
    urlRef.current?.setCustomValidity(urlProblem ?? "");
  }, [urlProblem]);

  function handleUrlChange(value: string) {
    setUrl(value);
    setCheck(null);
    if (value.trim() === "") {
      setUrlError(null);
      onChange({ ...block, videoId: undefined, externalUrl: undefined, mediaId: undefined });
      return;
    }
    const next = parseYouTubeUrl(value);
    if (!next) {
      setUrlError("That isn't a supported YouTube link. Use a youtube.com/watch, youtube.com/shorts or youtu.be link.");
      return;
    }
    setUrlError(null);
    onChange({
      ...block,
      provider: "youtube",
      videoId: next.videoId,
      externalUrl: undefined,
      mediaId: undefined,
      orientation: next.isShort ? "portrait" : (block.orientation ?? "landscape"),
    });
  }

  function runCheck() {
    startCheck(async () => setCheck(await checkYouTubeVideoAction(url)));
  }

  const result = check?.check;

  return (
    <div className="space-y-3">
      <div>
        <AdminLabel htmlFor={`${fieldId}-url`}>YouTube link</AdminLabel>
        <div className="flex flex-wrap gap-2">
          <AdminInput
            ref={urlRef}
            id={`${fieldId}-url`}
            required
            inputMode="url"
            autoComplete="off"
            placeholder="https://youtu.be/…  or  https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            aria-invalid={Boolean(urlError)}
            className="min-w-[16rem] flex-1"
          />
          <AdminButton type="button" variant="secondary" disabled={!parsed || checking} onClick={runCheck}>
            {checking ? "Checking…" : "Check on YouTube"}
          </AdminButton>
        </div>
        {urlError && (
          <p role="alert" className="mt-1 font-body text-xs text-danger">
            {urlError}
          </p>
        )}
        {unsupportedLegacy && !urlError && (
          <p role="alert" className="mt-1 font-body text-xs text-danger">
            This block holds an older link that isn&rsquo;t a supported YouTube link, so it isn&rsquo;t shown on the site and can&rsquo;t be
            saved. Paste a YouTube link, or remove the block.
          </p>
        )}
        {block.videoId && !urlError && (
          <p className="mt-1 font-body text-xs text-foreground-muted">
            Video ID: <span className="font-mono">{block.videoId}</span>
            {block.orientation === "portrait" ? " · vertical (Short) player" : ""}
          </p>
        )}
        {check?.error && (
          <p role="alert" className="mt-1 font-body text-xs text-danger">
            {check.error}
          </p>
        )}
        {result?.availability === "embeddable" && (
          <p role="status" className="mt-1 font-body text-xs text-foreground-muted">
            YouTube reports this video as available to embed
            {result.title ? (
              <>
                {" "}
                — title on YouTube: &ldquo;{result.title}&rdquo;{" "}
                {block.title !== result.title && (
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={() => onChange({ ...block, title: result.title })}
                  >
                    Use this title
                  </button>
                )}
              </>
            ) : null}
            .
          </p>
        )}
        {result && result.availability !== "embeddable" && (
          <p role="alert" className="mt-1 font-body text-xs text-danger">
            {CHECK_MESSAGES[result.availability]}
          </p>
        )}
      </div>

      <div>
        <AdminLabel htmlFor={`${fieldId}-title`}>Title (required — the player&rsquo;s accessible label)</AdminLabel>
        <AdminInput
          id={`${fieldId}-title`}
          required
          maxLength={200}
          value={block.title ?? ""}
          onChange={(e) => onChange({ ...block, title: e.target.value || undefined })}
        />
      </div>

      <div>
        <AdminLabel htmlFor={`${fieldId}-caption`}>Caption (optional)</AdminLabel>
        <AdminInput
          id={`${fieldId}-caption`}
          maxLength={500}
          value={block.caption ?? ""}
          onChange={(e) => onChange({ ...block, caption: e.target.value || undefined })}
        />
      </div>

      <div>
        <AdminLabel htmlFor={`${fieldId}-orientation`}>Player shape</AdminLabel>
        <AdminSelect
          id={`${fieldId}-orientation`}
          value={block.orientation ?? "landscape"}
          onChange={(e) => onChange({ ...block, orientation: e.target.value as "landscape" | "portrait" })}
          className="max-w-[260px]"
        >
          <option value="landscape">Landscape (16:9)</option>
          <option value="portrait">Vertical / Short (9:16)</option>
        </AdminSelect>
      </div>

      <div>
        <AdminLabel>Thumbnail (optional)</AdminLabel>
        <MediaPicker
          selected={
            block.thumbnailMediaId
              ? { id: block.thumbnailMediaId, url: current?.url ?? null, alt_text: current?.alt_text ?? null }
              : null
          }
          onSelect={(media) => {
            onMediaResolved(media);
            onChange({ ...block, thumbnailMediaId: media.id });
          }}
          onClear={() => onChange({ ...block, thumbnailMediaId: undefined })}
        />
        <p className="mt-1 font-body text-xs text-foreground-muted">
          Shown on the site before anyone presses play, so it must be a public (promoted) image. Nothing is loaded from YouTube until a
          visitor presses play.
        </p>
      </div>

      <p className="border border-border bg-surface px-3 py-2 font-body text-xs text-foreground-muted">
        Saving, reviewing or publishing in Springboard does not change the video&rsquo;s privacy on YouTube. A public video can be found
        on YouTube independently, and an unlisted video can be watched by anyone who has its link — so don&rsquo;t use either for
        confidential footage. The player only appears on the site once the article itself is published.
      </p>
    </div>
  );
}
