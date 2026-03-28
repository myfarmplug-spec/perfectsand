import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Perfect Sand",
    short_name: "Perfect Sand",
    description: "Discipline and urge-management by Voice of Osa",
    start_url: "/",
    display: "standalone",
    background_color: "#0F1117",
    theme_color: "#0F1117",
    orientation: "portrait",
    lang: "en-NG",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
