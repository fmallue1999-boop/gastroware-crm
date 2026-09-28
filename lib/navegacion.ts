/**
 * Menú por puesto: cada uno ve primero lo suyo (docs/MODELO-OPERATIVO.md).
 * La barra lateral de la computadora muestra todo; la barra del celular,
 * las primeras cuatro cosas (la última siempre es "Más").
 */

export type ClaveIcono =
  | "embudo"
  | "midia"
  | "tablero"
  | "aprobaciones"
  | "informes"
  | "contactos"
  | "ventas"
  | "cobranzas"
  | "casos"
  | "services"
  | "equipos"
  | "stock"
  | "movimientos"
  | "marketing"
  | "pedidos_material"
  | "videos"
  | "mas";

export type ItemMenu = { href: string; label: string; icono: ClaveIcono; badgeHoy?: boolean };

const I = {
  embudo: { href: "/", label: "Embudo", icono: "embudo" },
  midia: { href: "/hoy", label: "Mi día", icono: "midia", badgeHoy: true },
  tablero: { href: "/tablero", label: "Tablero", icono: "tablero" },
  aprobaciones: { href: "/aprobaciones", label: "Aprobaciones", icono: "aprobaciones" },
  informes: { href: "/informes", label: "Informes", icono: "informes" },
  informe: { href: "/informe", label: "Mi informe", icono: "informes" },
  contactos: { href: "/clientes", label: "Contactos", icono: "contactos" },
  ventas: { href: "/pedidos", label: "Ventas", icono: "ventas" },
  cobranzas: { href: "/cobranzas", label: "Cobranzas", icono: "cobranzas" },
  casos: { href: "/casos", label: "Casos", icono: "casos" },
  services: { href: "/servicio", label: "Services", icono: "services" },
  equipos: { href: "/equipos", label: "Equipos", icono: "equipos" },
  stock: { href: "/stock", label: "Stock", icono: "stock" },
  movimientos: { href: "/movimientos", label: "Movimientos", icono: "movimientos" },
  marketing: { href: "/marketing", label: "Campañas", icono: "marketing" },
  pedidos_material: { href: "/marketing/pedidos", label: "Pedidos de material", icono: "pedidos_material" },
  videos: { href: "/marketing/videos", label: "Videos", icono: "videos" },
  mas: { href: "/mas", label: "Más", icono: "mas" },
} satisfies Record<string, ItemMenu>;

export function menuDe(rol: string): { lateral: ItemMenu[]; celular: ItemMenu[] } {
  switch (rol) {
    case "tecnico":
      return {
        lateral: [I.midia, I.services, I.equipos, I.contactos, I.stock, I.ventas, I.movimientos, I.mas],
        celular: [I.midia, I.services, I.equipos, I.mas],
      };
    case "servicio":
      return {
        lateral: [I.midia, I.services, I.casos, I.equipos, I.contactos, I.stock, I.movimientos, I.mas],
        celular: [I.midia, I.services, I.casos, I.mas],
      };
    case "administrativa":
      return {
        lateral: [I.midia, I.ventas, I.cobranzas, I.contactos, I.casos, I.services, I.stock, I.movimientos, I.mas],
        celular: [I.midia, I.ventas, I.cobranzas, I.mas],
      };
    case "admin":
      return {
        lateral: [I.midia, I.tablero, I.cobranzas, I.ventas, I.services, I.casos, I.contactos, I.stock, I.informes, I.movimientos, I.mas],
        celular: [I.midia, I.cobranzas, I.services, I.mas],
      };
    case "marketing":
      return {
        lateral: [I.midia, I.pedidos_material, I.videos, I.marketing, I.contactos, I.movimientos, I.mas],
        celular: [I.midia, I.pedidos_material, I.contactos, I.mas],
      };
    case "direccion":
      return {
        lateral: [I.embudo, I.midia, I.tablero, I.aprobaciones, I.informes, I.contactos, I.ventas, I.cobranzas, I.casos, I.services, I.stock, I.movimientos, I.mas],
        celular: [I.embudo, I.midia, I.contactos, I.mas],
      };
    case "distribuidor":
      return { lateral: [I.embudo, I.midia, I.contactos, I.ventas, I.mas], celular: [I.embudo, I.midia, I.contactos, I.mas] };
    default:
      // Vendedor de territorio
      return {
        lateral: [I.embudo, I.midia, I.contactos, I.ventas, I.casos, I.informe, I.stock, I.movimientos, I.mas],
        celular: [I.embudo, I.midia, I.contactos, I.mas],
      };
  }
}

/** El botón de cargar de cada puesto. */
export function botonCrear(rol: string): { href: string; label: string } {
  if (rol === "tecnico" || rol === "servicio") return { href: "/servicio/cargar", label: "Cargar service hecho" };
  return { href: "/alta", label: "Nueva consulta" };
}

/** Si un ítem del menú está activo para la ruta actual. */
export function estaActivo(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/clientes") return pathname.startsWith("/clientes") && !pathname.startsWith("/clientes/importar");
  if (href === "/servicio") return pathname === "/servicio" || /^\/servicio\/(?!cargar|aliados)/.test(pathname);
  if (href === "/marketing") return pathname === "/marketing" || /^\/marketing\/(?!pedidos|videos)/.test(pathname);
  if (href === "/informe") return pathname === "/informe";
  return pathname.startsWith(href);
}
