/**
 * Puestos del modelo operativo (docs/MODELO-OPERATIVO.md). El CRM no usa
 * nombres de personas: cada usuario tiene un puesto (usuarios.rol) y, si
 * vende, un territorio. Estas funciones dicen qué puede hacer cada puesto.
 */

export type Puesto =
  | "direccion"
  | "admin"
  | "administrativa"
  | "comercial"
  | "servicio"
  | "tecnico"
  | "marketing"
  | "distribuidor";

export const PUESTOS: { value: Puesto; label: string; detalle: string }[] = [
  { value: "direccion", label: "Dirección general", detalle: "Estrategia, precios, aprobaciones fuera de lista, cuentas clave e importaciones." },
  { value: "admin", label: "Dirección de administración y operaciones", detalle: "Control de remitos, cobranzas, pagos, depósito y servicio técnico mientras no haya responsable." },
  { value: "administrativa", label: "Administrativa y atención comercial", detalle: "Carga y asigna consultas, factura, cobra, prepara y despacha, recontacta consumibles." },
  { value: "comercial", label: "Vendedor de territorio", detalle: "Dueño de las cuentas de su territorio: del primer contacto a la postventa." },
  { value: "servicio", label: "Responsable de servicio técnico", detalle: "Unidad de servicio: remitos, aliados, garantías y calidad." },
  { value: "tecnico", label: "Técnico de servicio y depósito", detalle: "Reparaciones, instalaciones y depósito; cada trabajo termina con remito." },
  { value: "marketing", label: "Marketing y contenido", detalle: "Contenido, material comercial, videos por modelo y pauta." },
  { value: "distribuidor", label: "Distribuidor", detalle: "Ve solo su cartera." },
];

export const nombrePuesto = (rol: string | null | undefined) =>
  PUESTOS.find((p) => p.value === rol)?.label ?? rol ?? "Sin puesto";

/** Aprueba lo que es de dirección (fuera de lista, condición sin cobro, reglas). */
export const esDireccion = (rol: string | null | undefined) => rol === "direccion";
/** Dirección general o dirección de administración. */
export const esGestor = (rol: string | null | undefined) => rol === "direccion" || rol === "admin";
/** Ve toda la operación. */
export const veTodo = (rol: string | null | undefined) =>
  ["direccion", "admin", "administrativa", "servicio"].includes(rol ?? "");
/** Factura y registra cobros. */
export const factura = (rol: string | null | undefined) => ["direccion", "admin", "administrativa"].includes(rol ?? "");
/** Controla remitos, asigna aliados y sigue garantías. */
export const controlaServicio = (rol: string | null | undefined) => ["direccion", "admin", "servicio"].includes(rol ?? "");
/** Trabaja intereses (vende). */
export const vende = (rol: string | null | undefined) => ["direccion", "comercial", "distribuidor"].includes(rol ?? "");
