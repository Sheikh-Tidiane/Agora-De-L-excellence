import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    lang: "fr",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    categories: ["education", "books", "social"],
    background_color: site.backgroundColor,
    theme_color: site.themeColor,
    icons: [
      { src: "/logos/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/logos/icone-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/logos/icone-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
