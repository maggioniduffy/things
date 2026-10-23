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
    background_color: "#f3f4f6",
    theme_color: "#f3f4f6",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
