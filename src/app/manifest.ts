import type { MetadataRoute } from "next";
import { LEGACY_THEME_COLOR } from "@/lib/themes";

export default function manifest(): MetadataRoute.Manifest {
  return { display: "standalone", theme_color: LEGACY_THEME_COLOR, name: "Holodex", short_name: "Holodex", background_color: LEGACY_THEME_COLOR, scope: "/", start_url: "/", icons: [{ src: "/img/icons/android-chrome-192x192.png", sizes: "192x192", type: "image/png" }, { src: "/img/icons/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }] };
}
