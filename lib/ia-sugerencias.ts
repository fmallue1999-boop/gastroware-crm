import type { Puesto } from "@/lib/puestos";

/** Preguntas de ejemplo del asistente, por puesto (se tocan y se mandan). */
export const SUGERENCIAS_IA: Record<Puesto, string[]> = {
  comercial: [
    "¿Qué tengo que hacer hoy?",
    "¿Qué propuestas no seguí hace más de una semana?",
    "¿Qué consultas tengo sin primer contacto?",
    "Redactame un WhatsApp para retomar una propuesta que no contestaron",
    "¿Cómo informo una venta para que la facturen?",
  ],
  direccion: [
    "¿Cómo viene el mes comparado con el anterior?",
    "¿Qué alertas hay hoy y qué hago con cada una?",
    "¿Qué propuestas esperan mi aprobación?",
    "¿Qué vendedor tiene más consultas atrasadas?",
    "¿Qué cobranzas vencidas son las más grandes?",
  ],
  admin: [
    "¿Qué cobranzas están vencidas y cuánto suman?",
    "¿Qué services hay para asignar y cuáles están parados?",
    "¿Qué remitos faltan controlar?",
    "¿Cómo viene el mes?",
  ],
  administrativa: [
    "¿Qué ventas tengo para facturar hoy?",
    "Armame los mensajes de reclamo de las facturas vencidas",
    "¿Qué hay para preparar y despachar?",
    "¿Qué consultas están sin asignar?",
    "¿Cómo registro un cobro?",
  ],
  servicio: [
    "¿Qué services hay para asignar?",
    "¿Qué remitos faltan controlar?",
    "¿Qué casos tienen la respuesta vencida?",
    "¿Cómo sigo un reclamo de garantía?",
  ],
  tecnico: [
    "¿Qué trabajos tengo hoy?",
    "¿Cómo cierro un service con el remito?",
    "¿Qué tengo que preparar en el depósito?",
    "¿Qué trabajos están esperando el cobro?",
  ],
  marketing: [
    "¿Qué pedidos de material tengo pendientes?",
    "¿De qué modelos falta el video?",
    "¿Qué productos del catálogo no tienen descripción completa?",
  ],
  distribuidor: ["¿Qué tengo que hacer hoy?", "¿Qué consultas tengo abiertas?"],
};
