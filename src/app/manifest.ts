import type { MetadataRoute } from "next";

// #070707 = oklch(0.13 0 0), the dark-mode --background in globals.css.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "InspoMe",
    short_name: "InspoMe",
    description:
      "Save TikTok and Instagram videos and learn why they work with AI analysis.",
    start_url: "/library",
    display: "standalone",
    background_color: "#070707",
    theme_color: "#f58057",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    share_target: {
      action: "/save",
      method: "GET",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
  };
}
