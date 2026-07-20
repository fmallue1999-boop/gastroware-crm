export default function manifest() {
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
    // Compartir desde WhatsApp u otra app directo al alta de lead
    share_target: {
      action: "/alta",
      method: "GET",
      params: {
        title: "titulo",
        text: "texto",
        url: "url",
      },
    },
  };
}
