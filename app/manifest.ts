import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GastroWare CRM",
    short_name: "CRM",
    description: "Cockpit de ventas GastroWare / Zumex",
    start_url: "/hoy",
    display: "standalone",
    background_color: "#f1efe7",
    theme_color: "#111111",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
