import type { MetadataRoute } from "next";

/**
 * Home-screen install manifest.
 *
 * `standalone` display is the point: launched from the home screen this opens
 * without browser chrome, so a two-tap log isn't framed by a URL bar and a
 * back button.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "four",
    short_name: "four",
    description: "Uptime monitor for one body.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d1013",
    theme_color: "#0d1013",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}
