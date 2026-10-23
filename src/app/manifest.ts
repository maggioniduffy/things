import type { MetadataRoute } from "next";
import { getT } from "@/i18n/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { manifest: m } = (await getT()).meta;
  return {
    name: m.name,
    short_name: m.shortName,
    description: m.description,
    start_url: "/app",
    display: "standalone",
    // --color-paper; the manifest can't read CSS variables.
    background_color: "rgb(243 244 246)",
    theme_color: "rgb(243 244 246)",
    icons: [
      { src: "/brand/icon-ink-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-ink-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
