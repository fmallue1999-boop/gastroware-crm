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
  | "guia"
  | "asistente"
  | "tareas"
  | "consumibles"
  | "repuestos"
  | "contenidos"
  | "material"
  | "mas";

export type ItemMenu = { href: string; label: string; icono: ClaveIcono; badgeHoy?: boolean; badgeAprobar?: boolean };

const I = {
  embudo: { href: "/", label: "Embudo", icono: "embudo" },
  midia: { href: "/hoy", label: "Mi día", icono: "midia", badgeHoy: true },
  tablero: { href: "/tablero", label: "Tablero", icono: "tablero" },
  aprobaciones: { href: "/aprobaciones", label: "Aprobaciones", icono: "aprobaciones", badgeAprobar: true },
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
  pedidos_material: { href: "/marketing/pedidos", label: "Pedidos a marketing", icono: "pedidos_material" },
  videos: { href: "/marketing/videos", label: "Videos", icono: "videos" },
  guia: { href: "/guia", label: "Guía de uso", icono: "guia" },
  asistente: { href: "/asistente", label: "Asistente IA", icono: "asistente" },
  tareas: { href: "/tareas", label: "Tareas", icono: "tareas" },
  consumibles: { href: "/consumibles", label: "Consumibles", icono: "consumibles" },
  repuestos: { href: "/repuestos", label: "Repuestos", icono: "repuestos" },
  contenidos: { href: "/contenidos", label: "Contenidos", icono: "contenidos" },
  material: { href: "/material", label: "Material", icono: "material" },
  mas: { href: "/mas", label: "Más", icono: "mas" },
} satisfies Record<string, ItemMenu>;

/**
 * Menú del puesto. El calendario de contenidos lo ven marketing y dirección
 * siempre, y cualquier otro puesto si dirección lo habilitó (veContenidos).
 */
export function menuDe(rol: string, opciones: { veContenidos?: boolean } = {}): { lateral: ItemMenu[]; celular: ItemMenu[] } {
  const menu = menuDelPuesto(rol);
  // Material lo ve todo el equipo
  if (!menu.lateral.some((i) => i.href === "/material")) {
    const guia = menu.lateral.findIndex((i) => i.href === "/guia");
    menu.lateral.splice(guia >= 0 ? guia : menu.lateral.length - 1, 0, I.material);
  }
  if (opciones.veContenidos && !menu.lateral.some((i) => i.href === "/contenidos")) {
    const guia = menu.lateral.findIndex((i) => i.href === "/guia");
    menu.lateral.splice(guia >= 0 ? guia : menu.lateral.length - 1, 0, I.contenidos);
  }
  return menu;
}

function menuDelPuesto(rol: string): { lateral: ItemMenu[]; celular: ItemMenu[] } {
  switch (rol) {
    case "tecnico":
      return {
        lateral: [I.midia, I.tareas, I.asistente, I.services, I.repuestos, I.equipos, I.contactos, I.stock, I.ventas, I.movimientos, I.guia, I.mas],
        celular: [I.midia, I.services, I.equipos, I.mas],
      };
    case "servicio":
      return {
        lateral: [I.midia, I.tareas, I.asistente, I.services, I.casos, I.repuestos, I.equipos, I.contactos, I.stock, I.movimientos, I.guia, I.mas],
        celular: [I.midia, I.services, I.casos, I.mas],
      };
    case "administrativa":
      return {
        lateral: [I.midia, I.tareas, I.asistente, I.ventas, I.consumibles, I.repuestos, I.cobranzas, I.contactos, I.casos, I.services, I.stock, I.movimientos, I.guia, I.mas],
        celular: [I.midia, I.ventas, I.cobranzas, I.mas],
      };
    case "admin":
      return {
        lateral: [I.midia, I.tareas, I.asistente, I.tablero, I.cobranzas, I.ventas, I.consumibles, I.repuestos, I.services, I.casos, I.contactos, I.stock, I.informes, I.contenidos, I.movimientos, I.guia, I.mas],
        celular: [I.midia, I.cobranzas, I.services, I.mas],
      };
    case "marketing":
      return {
        lateral: [I.midia, I.contenidos, I.material, I.tareas, I.asistente, I.pedidos_material, I.videos, I.marketing, I.contactos, I.movimientos, I.guia, I.mas],
        celular: [I.midia, I.contenidos, I.material, I.mas],
      };
    case "direccion":
      return {
        lateral: [I.embudo, I.midia, I.tareas, I.asistente, I.tablero, I.aprobaciones, I.informes, I.contenidos, I.pedidos_material, I.contactos, I.ventas, I.consumibles, I.repuestos, I.cobranzas, I.casos, I.services, I.stock, I.movimientos, I.guia, I.mas],
        celular: [I.embudo, I.midia, I.contactos, I.mas],
      };
    case "distribuidor":
      return { lateral: [I.embudo, I.midia, I.tareas, I.asistente, I.contactos, I.ventas, I.guia, I.mas], celular: [I.embudo, I.midia, I.contactos, I.mas] };
    default:
      // Vendedor de territorio
      return {
        lateral: [I.embudo, I.midia, I.tareas, I.asistente, I.contactos, I.material, I.ventas, I.consumibles, I.repuestos, I.casos, I.informe, I.stock, I.movimientos, I.guia, I.mas],
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
