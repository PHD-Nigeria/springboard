"use server";

import { getAdminSession } from "@/lib/auth/session";
import { parseYouTubeUrl } from "@/lib/video/youtube";
import { checkYouTubeVideo, type YouTubeCheckResult } from "@/lib/video/youtube-oembed";

export interface CheckYouTubeResult {
  error: string | null;
  isShort?: boolean;
  check?: YouTubeCheckResult;
}

/**
 * Backs the block editor's "Check on YouTube" button. Signed-in staff only
 * (same contributor-and-above gate as the rest of the admin), and the link is
 * parsed with the same strict parser the save path uses — an unsupported URL
 * is refused here without ever being sent anywhere. Read-only: it saves
 * nothing, and it reports YouTube's title for the editor to accept or ignore.
 */
export async function checkYouTubeVideoAction(url: string): Promise<CheckYouTubeResult> {
  const session = await getAdminSession();
  if (!session) return { error: "Your session has expired — sign in again." };

  const parsed = parseYouTubeUrl(url);
  if (!parsed) {
    return { error: "That isn't a supported YouTube link. Use a youtube.com/watch, youtube.com/shorts or youtu.be link." };
  }

  return { error: null, isShort: parsed.isShort, check: await checkYouTubeVideo(parsed.videoId) };
}
