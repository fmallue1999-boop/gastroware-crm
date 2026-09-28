/**
 * Versiones de GastroWare OS (docs/VERSIONES.md). La primera es la actual.
 * Cada actualización que se publica suma una versión acá, sube la de
 * package.json y se marca con un tag de git (vX.Y.Z). El test de versiones
 * falla si package.json y esta lista no coinciden.
 *
 * Cómo se numera: X.Y.Z
 *  - Z (1.0.1): arreglos, sin cambios de uso.
 *  - Y (1.1.0): funciones nuevas o cambios que el equipo nota.
 *  - X (2.0.0): cambios grandes en la forma de trabajar.
 */

export type Version = {
  version: string;
  fecha: string;
  titulo: string;
  cambios: string[];
};

export const VERSIONES: Version[] = [
  {
    version: "1.0.0",
    fecha: "2026-09-27",
    titulo: "GastroWare OS: la empresa trabaja por puestos",
    cambios: [
      "El sistema se llama GastroWare OS y tiene la marca de GastroWare (logo, colores e ícono). Dirección la puede cambiar en Administración → Marca.",
      "Cada persona tiene un puesto y ve su Mi día con lo que le toca hoy.",
      "Las consultas se asignan por lugar de entrega al vendedor del territorio y se mide el primer contacto (dentro de la hora).",
      "Cadencia de seguimiento de propuestas (días 1, 3, 7, 14, 30 y 60) y botón “No respondió”.",
      "Las propuestas fuera de lista esperan la aprobación de dirección antes de imprimirse.",
      "Circuito de venta del manual: informar, facturar, cobrar, preparar, despachar y entregar. Nada se prepara sin cobro.",
      "Postventa automática al entregar (días 2, 10 y 30) y recontacto de consumibles a cargo de la administrativa.",
      "Cobranzas: vencidas, vencen hoy y en 48 h, promesas y reclamo por WhatsApp.",
      "Casos de postventa con plazos, derivación a servicio técnico y cierre con causa y solución.",
      "Servicio técnico: remito obligatorio con fotos, control del remito, técnicos aliados, cobro previo fuera de garantía, acta de instalación y reclamos de garantía.",
      "Informe comercial de los lunes, pedidos de material a marketing y videos por modelo.",
      "Tablero con la operación del manual y guía de uso dentro del sistema.",
    ],
  },
];

export const VERSION = VERSIONES[0].version;

/** "v1.0" para mostrar (sin el último número si es 0). */
export function versionCorta(v: string = VERSION): string {
  const [x, y, z] = v.split(".");
  return z && z !== "0" ? `v${x}.${y}.${z}` : `v${x}.${y}`;
}
