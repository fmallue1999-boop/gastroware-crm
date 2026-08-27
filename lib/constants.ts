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

export const ESTADOS_CLIENTE = [
  { value: "prospecto", label: "Prospectos" },
  { value: "cliente_activo", label: "Clientes activos" },
  { value: "inactivo", label: "Inactivos" },
] as const;

export const ORIGENES = [
  "WhatsApp",
  "Instagram",
  "Pauta Meta",
  "Web",
  "Mercado Libre",
  "Referido",
  "Vendedor",
  "Visita",
  "Otro",
] as const;

/** Qué pidió el cliente al entrar: define el guión y la primera tarea. */
export const PEDIDOS = [
  { value: "precio", label: "Pide precio" },
  { value: "info", label: "Pide info" },
  { value: "general", label: "Consulta general" },
] as const;

/** Líneas de interés para la captura rápida en ferias. */
export const LINEAS_FERIA = [
  "Exprimidoras Zumex",
  "Licuadoras GX",
  "Café Jetinno",
  "Hornos Rational",
  "Lavado",
  "Consumibles",
  "Otro",
] as const;

export const PROVINCIAS_AR = [
  "Buenos Aires",
  "CABA",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const;

/** Etiquetas de categoría de producto (para agrupar el selector del alta). */
export const CATEGORIAS_PRODUCTO: Record<string, string> = {
  exprimidora: "Exprimidoras",
  licuadora: "Licuadoras",
  maquina_cafe: "Café automático",
  horno: "Hornos",
  consumible: "Consumibles",
  repuesto: "Repuestos",
  otro: "Otros",
};

export const ROLES = [
  { value: "direccion", label: "Dirección" },
  { value: "admin", label: "Administración" },
  { value: "comercial", label: "Comercial" },
  { value: "marketing", label: "Marketing" },
  { value: "tecnico", label: "Técnico" },
  { value: "distribuidor", label: "Distribuidor" },
] as const;

export const CONDICIONES_FISCALES = [
  { value: "responsable_inscripto", label: "Responsable Inscripto" },
  { value: "monotributo", label: "Monotributo" },
  { value: "exento", label: "Exento" },
  { value: "consumidor_final", label: "Consumidor Final" },
] as const;

export const ETAPAS = [
  { value: "nueva", label: "Nueva" },
  { value: "cotizada", label: "Cotizada" },
  { value: "seguimiento", label: "Seguimiento" },
  { value: "ganada", label: "Ganada" },
  { value: "perdida", label: "Perdida" },
] as const;

export const ETAPAS_ABIERTAS = ["nueva", "cotizada", "seguimiento"] as const;

/** Circuito del pedido una vez ganada la venta, en orden. */
export const PEDIDO_ESTADOS = [
  { value: "facturar", label: "Emitir factura" },
  { value: "pendiente_pago", label: "Pendiente de pago" },
  { value: "preparar_envio", label: "Preparando envío" },
  { value: "para_entregar", label: "Para entregar" },
  { value: "entregado", label: "Entregado" },
  { value: "finalizado", label: "Finalizado" },
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

export const CADENCIA_COTIZACION = [
  { dias: 2, uso: "d2", titulo: "Seguimiento D+2: preguntar financiación o alternativas" },
  { dias: 5, uso: "d5", titulo: "Seguimiento D+5: enviar video, caso o comparativa" },
  { dias: 10, uso: "d10", titulo: "Seguimiento D+10: preguntar el freno (valor, momento o comparación)" },
  { dias: 20, uso: "d20", titulo: "Reactivación D+20: última y pasar a nurturing" },
] as const;

/**
 * Espejo de la tabla ot_estados para labels y colores de UI.
 * La verdad sobre transiciones vive en la DB (ot_transiciones).
 */
export const ESTADOS_OT: {
  value: string;
  label: string;
  grupo: "tecnico" | "admin";
  color: string;
}[] = [
  { value: "solicitud_recibida", label: "Solicitud recibida", grupo: "admin", color: "bg-celeste-soft text-sky-800" },
  { value: "pendiente_revision", label: "Pendiente de revisión", grupo: "admin", color: "bg-celeste-soft text-sky-800" },
  { value: "pendiente_asignacion", label: "Pendiente de asignación", grupo: "admin", color: "bg-amber-100 text-amber-700" },
  { value: "programado", label: "Programado", grupo: "tecnico", color: "bg-celeste-soft text-sky-800" },
  { value: "asignado", label: "Asignado", grupo: "tecnico", color: "bg-celeste-soft text-sky-800" },
  { value: "en_camino", label: "En camino", grupo: "tecnico", color: "bg-amber-100 text-amber-700" },
  { value: "en_proceso", label: "En proceso", grupo: "tecnico", color: "bg-amber-100 text-amber-700" },
  { value: "esperando_repuesto", label: "Esperando repuesto", grupo: "tecnico", color: "bg-orange-100 text-orange-700" },
  { value: "esperando_cliente", label: "Esperando al cliente", grupo: "tecnico", color: "bg-orange-100 text-orange-700" },
  { value: "finalizado_tecnico", label: "Finalizado por técnico", grupo: "tecnico", color: "bg-purple-100 text-purple-700" },
  { value: "revision_admin", label: "En revisión administrativa", grupo: "admin", color: "bg-purple-100 text-purple-700" },
  { value: "devuelto_tecnico", label: "Devuelto al técnico", grupo: "tecnico", color: "bg-red-100 text-red-700" },
  { value: "aprobado_facturar", label: "Para facturar", grupo: "admin", color: "bg-orange-100 text-orange-700" },
  { value: "facturado", label: "Facturado", grupo: "admin", color: "bg-green-100 text-green-700" },
  { value: "cerrado", label: "Cerrado", grupo: "admin", color: "bg-green-100 text-green-700" },
  { value: "cancelado", label: "Cancelado", grupo: "admin", color: "bg-crema-deep text-piedra" },
];

/** Estados en los que el técnico todavía trabaja la orden. */
export const ESTADOS_OT_ACTIVOS = [
  "programado",
  "asignado",
  "en_camino",
  "en_proceso",
  "esperando_repuesto",
  "esperando_cliente",
  "devuelto_tecnico",
] as const;

export const TIPOS_OT = [
  { value: "correctivo", label: "Reparación" },
  { value: "preventivo", label: "Mantenimiento" },
  { value: "instalacion", label: "Instalación" },
  { value: "garantia", label: "Garantía" },
] as const;

export const PRIORIDADES_OT = [
  { value: "baja", label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
] as const;

export const COBERTURAS_OT = [
  { value: "facturable", label: "Facturable" },
  { value: "garantia", label: "Por garantía" },
  { value: "contrato", label: "Por contrato" },
] as const;

export const ESTADOS_ITEM_OT = [
  { value: "pendiente", label: "Pendiente" },
  { value: "facturable", label: "Facturable" },
  { value: "garantia", label: "Por garantía" },
  { value: "cortesia", label: "Sin cargo" },
] as const;
