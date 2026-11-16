import type { MetadataRoute } from "next";

// Lets Millie add Personal to her phone's home screen as an app: its own icon,
// full screen with no browser bar, opening straight on the calendar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MailBakes Personal",
    short_name: "Personal",
    description: "Millie's diary, calendar and inbox.",
    start_url: "/diary",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF8F9",
    theme_color: "#ED217A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
