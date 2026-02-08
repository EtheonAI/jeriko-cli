import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rubic",
    short_name: "Rubic",
    description: "Your AI-powered assistant for everything",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/static/favicon/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/static/favicon/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
