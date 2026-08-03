export const RUBROS = [
  "Cafetería",
  "Cadena de cafeterías",
  "Restaurante",
  "Hotel",
  "Heladería",
  "Estación de servicio",
  "Supermercado",
  "Panadería",
  "Bar",
  "Catering",
  "Otro",
] as const;

export const ORIGENES = [
  "WhatsApp",
  "Instagram",
  "Web",
  "Mercado Libre",
  "Referido",
  "Vendedor",
  "Visita",
  "Otro",
] as const;

export const ETAPAS = [
  { value: "nueva", label: "Nueva" },
  { value: "diagnostico", label: "Diagnóstico" },
  { value: "cotizada", label: "Cotizada" },
  { value: "seguimiento", label: "Seguimiento" },
  { value: "negociacion", label: "Negociación" },
  { value: "ganada", label: "Ganada" },
  { value: "perdida", label: "Perdida" },
] as const;

export const ETAPAS_ABIERTAS = [
  "nueva",
  "diagnostico",
  "cotizada",
  "seguimiento",
  "negociacion",
] as const;

export const TEMPERATURAS = [
  { value: "caliente", label: "Caliente" },
  { value: "tibio", label: "Tibio" },
  { value: "frio", label: "Frío" },
] as const;

export const OBJECIONES = [
  "Precio",
  "Marca / confianza",
  "Financiación",
  "Garantía",
  "Espacio",
  "Limpieza / operación",
  "No es prioridad",
  "Está comparando",
  "Desaparece / no responde",
] as const;

export const MOTIVOS_PERDIDA = [
  "Precio",
  "Compró competencia",
  "No era el momento",
  "Sin respuesta",
  "Financiación",
  "Espacio / operación",
  "Otro",
] as const;

export const FORMAS_PAGO = [
  "Contado",
  "Anticipo + cuotas",
  "E-cheq",
  "Tarjeta",
  "Mercado Pago",
  "Financiación bancaria",
] as const;

/** Respuesta sugerida por objeción (sección 9.2 del análisis). */
export const ACCION_POR_OBJECION: Record<string, string> = {
  Precio:
    "Mostrar financiación, comparación de costo de roturas o cuenta de recupero.",
  "Marca / confianza":
    "Enviar respaldo: garantía, repuestos, servicio técnico local, trayectoria y casos.",
  Financiación: "Pasar opciones concretas: anticipo + cuotas, e-cheqs, tarjeta.",
  Garantía: "Enviar detalle de garantía, repuestos y soporte local.",
  Espacio: "Pedir medidas y proponer el modelo que entra en el espacio.",
  "Limpieza / operación": "Enviar video o guía breve de limpieza y mantenimiento.",
  "No es prioridad":
    "Programar reactivación a 30/45 días y pedir fecha tentativa.",
  "Está comparando":
    "Registrar la marca comparada y enviar la matriz comparativa.",
  "Desaparece / no responde":
    "Seguir la cadencia D+2/D+5/D+10 y cerrar con la reactivación D+20.",
};

export const ESTADOS_OT = [
  { value: "abierta", label: "Abierta" },
  { value: "en_proceso", label: "En proceso" },
  { value: "cerrada_tecnico", label: "Cerrada por técnico" },
  { value: "facturable", label: "Para facturar" },
  { value: "facturada", label: "Facturada" },
  { value: "anulada", label: "Anulada" },
] as const;

export const TIPOS_OT = [
  { value: "correctivo", label: "Reparación" },
  { value: "preventivo", label: "Mantenimiento" },
  { value: "instalacion", label: "Instalación" },
  { value: "garantia", label: "Garantía" },
] as const;

/** Cadencia automática al cotizar: días y uso de plantilla. */
export const CADENCIA_COTIZACION = [
  { dias: 2, uso: "d2", titulo: "Seguimiento D+2: preguntar financiación o alternativas" },
  { dias: 5, uso: "d5", titulo: "Seguimiento D+5: enviar video, caso o comparativa" },
  { dias: 10, uso: "d10", titulo: "Seguimiento D+10: preguntar el freno (valor, momento o comparación)" },
  { dias: 20, uso: "d20", titulo: "Reactivación D+20: última y pasar a nurturing" },
] as const;
