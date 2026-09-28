export default function manifest() {
  return {
    name: "GastroWare OS",
    short_name: "GastroWare OS",
    description: "Ventas, servicio técnico, administración y clientes en un solo lugar",
    start_url: "/",
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
