export default function manifest() {
  return {
    name: "GastroWare",
    short_name: "GastroWare",
    description: "Ventas, servicio técnico y contactos en un solo lugar",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f2ec",
    theme_color: "#17233a",
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
