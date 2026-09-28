/**
 * Actividad comercial (migración 030): algo que ya pasó (una llamada, un
 * WhatsApp, una visita) con su resultado. Distinta de la tarea, que es lo
 * que hay que hacer: en cada operación, el próximo contacto con su acción.
 * Una llamada sin respuesta es un intento, no una conversación.
 */

export type Medio = "llamada" | "whatsapp" | "email" | "visita" | "demo";
export type Resultado = "conversamos" | "no_respondio" | "quedo_en_responder" | "no_interesado" | "enviado" | "no_se_hizo";
export type Accion = "llamar" | "escribir" | "cotizar" | "demo" | "visitar" | "otra";
export type Linea = "equipos" | "consumibles" | "repuestos";

export const MEDIOS: { value: Medio; label: string }[] = [
  { value: "llamada", label: "Llamada" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "visita", label: "Visita" },
  { value: "demo", label: "Demo" },
];

export const RESULTADOS: Record<Resultado, string> = {
  conversamos: "Conversamos",
  no_respondio: "No respondió",
  quedo_en_responder: "Quedó en responder",
  no_interesado: "No le interesa",
  enviado: "Enviado, sin respuesta aún",
  no_se_hizo: "No se hizo",
};

/** Los resultados que tienen sentido para cada medio (un email enviado no es una respuesta). */
export const RESULTADOS_POR_MEDIO: Record<Medio, Resultado[]> = {
  llamada: ["conversamos", "no_respondio", "quedo_en_responder", "no_interesado"],
  whatsapp: ["conversamos", "enviado", "quedo_en_responder", "no_interesado"],
  email: ["enviado", "conversamos", "no_interesado"],
  visita: ["conversamos", "quedo_en_responder", "no_interesado", "no_se_hizo"],
  demo: ["conversamos", "quedo_en_responder", "no_interesado", "no_se_hizo"],
};

export const ACCIONES: { value: Accion; label: string }[] = [
  { value: "llamar", label: "Llamar" },
  { value: "escribir", label: "Escribir" },
  { value: "cotizar", label: "Cotizar" },
  { value: "demo", label: "Coordinar demo" },
  { value: "visitar", label: "Visitar" },
  { value: "otra", label: "Otra" },
];

export const LINEAS: { value: Linea; label: string; corto: string }[] = [
  { value: "equipos", label: "Venta de equipos", corto: "Equipos" },
  { value: "consumibles", label: "Consumibles", corto: "Consumibles" },
  { value: "repuestos", label: "Repuestos", corto: "Repuestos" },
];

export const nombreMedio = (m: string | null | undefined) => MEDIOS.find((x) => x.value === m)?.label ?? null;
export const nombreResultado = (r: string | null | undefined) => (r && r in RESULTADOS ? RESULTADOS[r as Resultado] : null);
export const nombreAccion = (a: string | null | undefined) => ACCIONES.find((x) => x.value === a)?.label ?? null;
export const nombreLinea = (l: string | null | undefined) => LINEAS.find((x) => x.value === l)?.corto ?? "Equipos";

/** ¿Hubo conversación? (el intento sin respuesta o el mensaje sin contestar no cuentan). */
export const esConversacion = (r: string | null | undefined) =>
  r === "conversamos" || r === "quedo_en_responder" || r === "no_interesado";

/** ¿Fue un intento de contacto? (toda actividad con medio, salvo la que no se hizo). */
export const esIntento = (medio: string | null | undefined, r: string | null | undefined) => Boolean(medio) && r !== "no_se_hizo";

/** "Llamada · No respondió" para el historial. */
export function textoActividad(medio: string | null | undefined, resultado: string | null | undefined): string {
  return [nombreMedio(medio), nombreResultado(resultado)].filter(Boolean).join(" · ");
}

/** Próximo paso sugerido según el resultado (se puede cambiar). null = no sugerir. */
export function sugerenciaPorResultado(medio: Medio | null, resultado: Resultado | null): { accion: Accion; dias: number } | null {
  switch (resultado) {
    case "no_respondio":
      return { accion: medio === "whatsapp" || medio === "email" ? "escribir" : "llamar", dias: 2 };
    case "enviado":
      return { accion: medio === "email" ? "llamar" : "escribir", dias: 3 };
    case "quedo_en_responder":
      return { accion: "escribir", dias: 3 };
    case "no_se_hizo":
      return { accion: medio === "demo" ? "demo" : "visitar", dias: 2 };
    default:
      return null;
  }
}

/** "Llamar · jue 2/10" (la fecha ya formateada viene de afuera). */
export const textoProximoPaso = (accion: string | null | undefined, cuando: string) =>
  [nombreAccion(accion), cuando].filter(Boolean).join(" · ");

/**
 * Nombre para mostrar: "Martín Pérez | Café Central". Si la persona es la
 * misma que el nombre del cliente (compra a título personal), solo uno.
 */
export function nombrePersonaEmpresa(persona: string | null | undefined, empresa: string): string {
  const p = persona?.trim();
  if (!p || p.toLowerCase() === empresa.trim().toLowerCase()) return empresa;
  return `${p} | ${empresa}`;
}

/** Saca el "Contacto: X" viejo de las notas cuando la persona ya está cargada aparte. */
export function notasSinContacto(notas: string | null | undefined): string | null {
  if (!notas) return null;
  const limpio = notas
    .split(" | ")
    .filter((parte) => !parte.startsWith("Contacto: "))
    .join(" | ")
    .trim();
  return limpio || null;
}
