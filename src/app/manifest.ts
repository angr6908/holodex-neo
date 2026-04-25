import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { display: "standalone", theme_color: "#42a5f5", name: "Holodex", short_name: "Holodex", background_color: "#42a5f5", scope: "/", start_url: "/", icons: [{ src: "/img/icons/android-chrome-192x192.png", sizes: "192x192", type: "image/png" }, { src: "/img/icons/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }] };
}
