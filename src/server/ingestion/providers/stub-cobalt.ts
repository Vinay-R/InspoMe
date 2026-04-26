import "server-only";

import type {
  MediaDownloadProvider,
  MediaDownloadResult,
} from "../types";
import { parseInspoUrl } from "@/lib/platform";

/**
 * Phase 1 stub. Returns a simulated download result so the rest of the pipeline
 * (Gemini analysis, UI status transitions) can be exercised without depending
 * on the real Cobalt fork being deployed.
 *
 * In Phase 2 this is replaced by an HTTP client that talks to COBALT_API_URL.
 * Nothing else in the system changes.
 */
export class StubCobaltProvider implements MediaDownloadProvider {
  readonly name = "stub-cobalt";

  canHandle(url: string): boolean {
    const { platform } = parseInspoUrl(url);
    return platform === "tiktok" || platform === "instagram";
  }

  async download(url: string): Promise<MediaDownloadResult> {
    // Simulate network jitter so loading states are visible end-to-end.
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));

    const parsed = parseInspoUrl(url);
    if (parsed.platform === "unknown") {
      return {
        success: false,
        platform: "unknown",
        sourceUrl: url,
        errorCode: "unsupported_platform",
        errorMessage: "Stub provider only handles TikTok and Instagram URLs.",
      };
    }

    return {
      success: true,
      platform: parsed.platform,
      sourceUrl: url,
      mediaFileUrl: undefined, // no real file in stub mode
      thumbnailUrl: `https://picsum.photos/seed/${encodeURIComponent(
        parsed.contentId ?? url,
      )}/720/1280`,
      durationSeconds: 18 + Math.floor(Math.random() * 42),
      fileSizeBytes: 4_000_000 + Math.floor(Math.random() * 8_000_000),
      mimeType: "video/mp4",
      creatorHandle: parsed.creatorHandle ?? undefined,
      caption: undefined,
    };
  }
}
