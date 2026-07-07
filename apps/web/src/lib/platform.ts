export type Platform = "tiktok" | "instagram" | "unknown";

export type ParsedUrl = {
  platform: Platform;
  canonical: string | null;
  contentId: string | null;
  creatorHandle: string | null;
};

const TIKTOK_VIDEO = /^https?:\/\/(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\/(?:@([\w.-]+)\/video\/(\d+)|t\/([A-Za-z0-9]+)|([A-Za-z0-9]+)\/?)/i;
const TIKTOK_SHORT = /^https?:\/\/(?:vm|vt)\.tiktok\.com\/([A-Za-z0-9]+)/i;
const INSTAGRAM = /^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|reels|tv)\/([\w-]+)/i;

export function parseInspoUrl(raw: string): ParsedUrl {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { platform: "unknown", canonical: null, contentId: null, creatorHandle: null };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { platform: "unknown", canonical: null, contentId: null, creatorHandle: null };
  }

  const stripped = `${url.protocol}//${url.host}${url.pathname}`;

  const tiktokMatch = trimmed.match(TIKTOK_VIDEO);
  if (tiktokMatch) {
    const handle = tiktokMatch[1] ?? null;
    const id = tiktokMatch[2] ?? tiktokMatch[3] ?? tiktokMatch[4] ?? null;
    return {
      platform: "tiktok",
      canonical: handle && id ? `https://www.tiktok.com/@${handle}/video/${id}` : stripped,
      contentId: id,
      creatorHandle: handle,
    };
  }

  if (TIKTOK_SHORT.test(trimmed)) {
    return {
      platform: "tiktok",
      canonical: stripped,
      contentId: null,
      creatorHandle: null,
    };
  }

  const igMatch = trimmed.match(INSTAGRAM);
  if (igMatch) {
    return {
      platform: "instagram",
      canonical: `https://www.instagram.com${url.pathname.replace(/\/$/, "")}/`,
      contentId: igMatch[1] ?? null,
      creatorHandle: null,
    };
  }

  return { platform: "unknown", canonical: stripped, contentId: null, creatorHandle: null };
}

export function isSupportedPlatform(p: Platform): p is "tiktok" | "instagram" {
  return p === "tiktok" || p === "instagram";
}

export function platformLabel(p: Platform): string {
  switch (p) {
    case "tiktok":
      return "TikTok";
    case "instagram":
      return "Instagram";
    default:
      return "Unknown";
  }
}
