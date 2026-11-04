import type { MetadataRoute } from "next";

/** Installing Together to the home screen (and push reminders on iOS, which need the app installed) */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Together",
    short_name: "Together",
    description: "Lists, plans, places and wishes — for the two of you.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf8f4",
    theme_color: "#fbf8f4",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
