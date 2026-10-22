import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Simulatore GdF Marescialli",
    short_name: "Simulatore GdF",
    description: "Simulazioni e quiz personalizzati per il concorso Allievi Marescialli GdF.",
    start_url: "/",
    display: "standalone",
    background_color: "#14171d",
    theme_color: "#14171d",
    icons: [{ src: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  }
}
