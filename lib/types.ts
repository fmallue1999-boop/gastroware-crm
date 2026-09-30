export type Rol =
  | "direccion"
  | "admin"
  | "administrativa"
  | "comercial"
  | "servicio"
  | "marketing"
  | "tecnico"
  | "distribuidor";

export type Etapa =
  | "nueva"
  | "cotizada"
  | "seguimiento"
  | "espera"
  | "ganada"
  | "perdida";

/** Circuito de la venta después de vender (manual, cadena 1.1). */
export type PedidoEstado =
  | "comprometido"
  | "facturado"
  | "preparar_envio"
  | "despachado"
  | "entregado";

export interface Usuario {
  id: string;
  nombre: string;
  rol: Rol;
  distribuidor_id: string | null;
  activo: boolean;
  telefono?: string | null;
  /** Territorio que atiende, si es vendedor. */
  territorio?: string | null;
  /** Migración 035: ve el calendario de contenidos (marketing y dirección siempre). */
  ve_contenidos?: boolean;
}

export interface Distribuidor {
  id: string;
  nombre: string;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  activo: boolean;
}

export interface Cliente {
  id: string;
  razon_social: string | null;
  nombre_comercial: string;
  cuit: string | null;
  condicion_fiscal: string | null;
  rubro: string;
  telefono: string | null;
  email: string | null;
  instagram_web: string | null;
  estado: "prospecto" | "cliente_activo" | "inactivo";
  potencial: string | null;
  comercial_id: string | null;
  distribuidor_id: string | null;
  notas: string | null;
  no_contactar: boolean;
  deleted_at: string | null;
  created_at: string;
  /** Derivado en queries: ciudad de la sucursal principal (no es columna de la tabla) */
  ciudad?: string | null;
}

export interface Sucursal {
  id: string;
  cliente_id: string;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  provincia: string | null;
  telefono: string | null;
  es_principal: boolean;
  /** Local con razón social propia (cuentas con varias razones sociales). */
  razon_social?: string | null;
  cuit?: string | null;
  contacto_facturacion?: string | null;
  email_facturacion?: string | null;
}

export interface Contacto {
  id: string;
  cliente_id: string;
  sucursal_id: string | null;
  nombre: string;
  cargo: string | null;
  telefono: string | null;
  email: string | null;
  es_decisor: boolean;
  consentimiento_email: boolean;
  consentimiento_whatsapp: boolean;
  deleted_at?: string | null;
}

export interface Modelo {
  id: string;
  marca: string;
  nombre: string;
  categoria: string;
  garantia_meses: number | null;
  activo: boolean;
}

export interface Producto {
  id: string;
  nombre: string;
  /** Video instructivo del modelo (lo carga marketing; se manda con el despacho). */
  video_url?: string | null;
  marca: string | null;
  categoria: string;
  modelo_id: string | null;
  es_consumible: boolean;
  frecuencia_recompra_dias: number | null;
  consumible_de: string | null;
  precio_referencia: number | null;
  moneda: string;
  /** Migración 033: precio de lista en pesos y en dólares (opcionales). */
  precio_ars?: number | null;
  precio_usd?: number | null;
  garantia_meses: number | null;
  activo: boolean;
  descripcion: string | null;
  destacados: string[];
  imagen_url: string | null;
  /** Unidades disponibles ahora (lo mantiene administración). */
  stock: number;
  /** Migración 034: código y detalle técnico (la segunda línea en la cotización). */
  codigo?: string | null;
  detalle_tecnico?: string | null;
}

export interface CotizacionItem {
  id: string;
  version_id: string;
  producto_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unit: number;
  descuento_pct: number;
  /** Migración 034: código y detalle del producto al cotizar. */
  codigo?: string | null;
  detalle?: string | null;
}

export interface Repuesto {
  id: string;
  codigo_interno: string | null;
  codigo_fabricante: string | null;
  descripcion: string;
  marca: string | null;
  costo: number | null;
  precio: number | null;
  moneda: string;
  stock: number | null;
  /** Repuesto crítico: mínimo a tener (los viernes se revisa). */
  stock_minimo?: number | null;
  ubicacion: string | null;
  garantia_meses: number | null;
  activo: boolean;
}

export interface Equipo {
  id: string;
  cliente_id: string;
  sucursal_id: string | null;
  modelo_id: string | null;
  producto_id: string | null;
  marca_modelo_libre: string | null;
  numero_serie: string | null;
  origen: "vendido" | "externo";
  estado: "activo" | "en_reparacion" | "baja";
  fecha_venta: string | null;
  fecha_instalacion: string | null;
  garantia_hasta: string | null;
  proximo_service: string | null;
  comercial_id: string | null;
  distribuidor_id: string | null;
  oportunidad_id: string | null;
  observaciones: string | null;
  created_at: string;
  producto?: Producto | null;
  modelo?: Modelo | null;
  sucursal?: Sucursal | null;
  cliente?: Cliente;
}

export interface Oportunidad {
  id: string;
  cliente_id: string;
  sucursal_id: string | null;
  producto_id: string | null;
  comercial_id: string | null;
  etapa: Etapa;
  temperatura: "caliente" | "tibio" | "frio" | null;
  origen: string;
  monto_estimado: number | null;
  moneda: string;
  diagnostico: Record<string, string | number | null>;
  objecion_principal: string | null;
  motivo_perdida: string | null;
  fecha_cierre_estimada: string | null;
  mensaje_inicial: string | null;
  /** Qué pidió al entrar: precio / info / general. */
  pedido: "precio" | "info" | "general" | null;
  /** Ids de productos consultados además del principal (producto_id). */
  productos_extra: string[];
  /** Apartado: equipos, consumibles o repuestos (migración 030). */
  linea?: string;
  /** Qué hacer en el próximo contacto (migración 030). */
  proxima_accion?: string | null;
  pedido_estado: PedidoEstado | null;
  entregado_at: string | null;
  entrega_estimada: string | null;
  nro_factura: string | null;
  /** Próxima fecha para volver a contactar por este interés (una sola, o ninguna). */
  proximo_contacto: string | null;
  /** Qué hacer en ese contacto ("Llegó stock", "mandar cotización"…). */
  proximo_nota: string | null;
  /** Se actualiza sola con cada movimiento (trigger en actividades). */
  ultimo_movimiento_at: string;
  /** Calificación y ruteo (manual, 1.1 pasos 2 y 3). */
  zona_entrega?: string | null;
  territorio?: string | null;
  cantidad?: number | null;
  plazo_compra?: string | null;
  decisor?: string | null;
  asignado_at?: string | null;
  primer_contacto_at?: string | null;
  /** Datos de la venta para facturar, cobrar y despachar. */
  forma_pago?: string | null;
  direccion_entrega?: string | null;
  lleva_instalacion?: boolean;
  relevamiento?: Record<string, string> | null;
  remito_nro?: string | null;
  prioridad_despacho?: number | null;
  transporte?: string | null;
  nro_seguimiento?: string | null;
  despachado_at?: string | null;
  videos_enviados_at?: string | null;
  vendido_at?: string | null;
  created_at: string;
  closed_at: string | null;
  cliente?: Cliente;
  producto?: Producto | null;
}

export interface Cotizacion {
  id: string;
  oportunidad_id: string;
  numero: number;
  estado: string;
  created_at: string;
  versiones?: CotizacionVersion[];
}

export interface CotizacionVersion {
  id: string;
  cotizacion_id: string;
  version: number;
  total: number | null;
  /** Migración 033: descuento especial de la operación. */
  subtotal?: number | null;
  descuento_pct?: number | null;
  descuento_motivo?: string | null;
  moneda: string;
  forma_pago: string | null;
  vigencia_dias: number | null;
  condiciones: string | null;
  archivo_path: string | null;
  created_at: string;
  creado_por?: string | null;
  /** Fuera de lista: dirección aprueba antes de presentarla (028). */
  aprobacion?: "no_requiere" | "pendiente" | "aprobada" | "rechazada";
  aprobacion_motivo?: string | null;
  aprobado_por?: string | null;
  aprobado_at?: string | null;
  aprobacion_nota?: string | null;
  /** Migración 034: IVA que se suma en el PDF (total es sin IVA), entrega y tipo de cambio. */
  iva_pct?: number | null;
  plazo_entrega?: string | null;
  condicion_entrega?: string | null;
  tipo_cambio?: number | null;
}

export interface Plantilla {
  id: string;
  nombre: string;
  uso: string;
  producto_id: string | null;
  contenido: string;
}

export interface Tarea {
  id: string;
  cliente_id: string;
  oportunidad_id: string | null;
  recurrencia_id: string | null;
  usuario_id: string | null;
  tipo: "seguimiento" | "reactivacion" | "recompra" | "postventa" | "otro";
  titulo: string;
  plantilla_id: string | null;
  vence_el: string;
  auto: boolean;
  completada_at: string | null;
  cancelada: boolean;
  cliente?: Cliente;
  oportunidad?: Oportunidad | null;
  plantilla?: Plantilla | null;
}

export interface Recurrencia {
  id: string;
  cliente_id: string;
  producto_id: string;
  frecuencia_dias: number | null;
  ultima_compra: string | null;
  proxima_alerta: string;
  activa: boolean;
  producto?: Producto;
  /** Migración 031: plan de reposición. */
  sucursal_id?: string | null;
  anticipacion_dias?: number;
  ultima_cantidad?: number | null;
  unidad?: string | null;
  responsable_id?: string | null;
  motivo_suspension?: string | null;
}

export interface Actividad {
  id: string;
  cliente_id: string;
  oportunidad_id: string | null;
  tipo: string;
  contenido: string | null;
  created_by: string | null;
  created_at: string;
  /** Migración 030: cómo fue el contacto y su resultado. */
  medio?: string | null;
  resultado?: string | null;
  ocurrio_at?: string | null;
  contacto_id?: string | null;
}

export interface OrdenTrabajo {
  id: string;
  numero: number;
  cliente_id: string;
  sucursal_id: string | null;
  equipo_id: string | null;
  tecnico_id: string | null;
  admin_id: string | null;
  creado_por: string | null;
  estado: string;
  prioridad: "baja" | "normal" | "alta" | "urgente";
  tipo: "correctivo" | "preventivo" | "instalacion" | "garantia";
  tipo_problema: string | null;
  cobertura: "facturable" | "garantia" | "contrato";
  fecha_solicitada: string | null;
  fecha_programada: string | null;
  problema: string | null;
  diagnostico: string | null;
  trabajo_realizado: string | null;
  firma_path: string | null;
  firmante: string | null;
  observacion_admin: string | null;
  total: number | null;
  nro_factura: string | null;
  facturada_at: string | null;
  created_at: string;
  cerrada_tecnico_at: string | null;
  cerrada_admin_at: string | null;
  /** Modelo operativo (028): caso de origen, aliado, venta, remito y cobro previo. */
  caso_id?: string | null;
  aliado_id?: string | null;
  oportunidad_id?: string | null;
  remito_nro?: string | null;
  tiempo_min?: number | null;
  presupuesto_monto?: number | null;
  presupuesto_moneda?: string | null;
  presupuesto_aprobado_at?: string | null;
  cobro_ok_at?: string | null;
  acta_capacitado?: string | null;
  acta_garantia_desde?: string | null;
  garantia_reclamo?: "a_presentar" | "presentado" | "repuesto_recibido" | "cerrado" | "rechazado" | null;
  garantia_reclamo_nota?: string | null;
  cliente?: Cliente;
  equipo?: Equipo | null;
  tecnico?: { id: string; nombre: string } | null;
}

export interface OTTiempo {
  id: string;
  ot_id: string;
  tecnico_id: string | null;
  inicio: string;
  fin: string | null;
  minutos: number | null;
  manual: boolean;
  justificacion: string | null;
}

export interface OTItem {
  id: string;
  ot_id: string;
  tipo: "refaccion" | "gasto";
  repuesto_id: string | null;
  descripcion: string;
  cantidad: number;
  costo_unit: number | null;
  precio_unit: number;
  estado: "facturable" | "garantia" | "cortesia" | "pendiente";
  aprobado_admin: boolean;
  comprobante_path: string | null;
}

export interface OTFoto {
  id: string;
  ot_id: string;
  momento: "antes" | "despues" | "otro";
  path: string;
}

export interface OTTransicion {
  desde: string;
  hacia: string;
  requiere_rol: "cualquiera" | "tecnico" | "gestor";
}

export interface StatusHistory {
  id: string;
  ot_id: string;
  desde: string | null;
  hacia: string;
  usuario_id: string | null;
  observacion: string | null;
  created_at: string;
}

export interface Documento {
  id: string;
  entidad: string;
  entidad_id: string;
  tipo: string;
  nombre: string;
  path: string;
  created_at: string;
}

export interface ChecklistPlantilla {
  id: string;
  nombre: string;
  modelo_id: string | null;
  items: string[];
  modelo?: Modelo | null;
}

export interface OTChecklist {
  id: string;
  ot_id: string;
  plantilla_id: string | null;
  respuestas: Record<string, import("./checklist").RespuestaChecklist>;
  plantilla?: ChecklistPlantilla | null;
}

export interface EquipoFoto {
  id: string;
  equipo_id: string;
  path: string;
  created_at: string;
}

export interface Notificacion {
  id: string;
  usuario_id: string;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  url: string | null;
  leida_at: string | null;
  created_at: string;
}

/** Mercadería que va a entrar: cantidad y fecha estimada por producto. */
export interface IngresoStock {
  id: string;
  producto_id: string;
  cantidad: number;
  fecha_estimada: string | null;
  recibido_at: string | null;
  nota: string | null;
  created_by: string | null;
  created_at: string;
  producto?: Producto | null;
}

/** Contacto escaneado en una feria (HOTELGA): seguimiento propio, estados y calificación. */
export interface FeriaLead {
  id: string;
  cliente_id: string;
  feria: string;
  numero: string | null;
  nombre: string | null;
  empresa: string | null;
  cargo: string | null;
  telefono: string | null;
  email: string | null;
  observaciones: string | null;
  calificacion: number | null;
  estado: "inicial" | "contactado" | "cerrado" | "descartado";
  asignado_a: string | null;
  contactado_por: string | null;
  contactado_at: string | null;
  created_at: string;
}

/** Factura cargada en el CRM (la emite el sistema de gestión); base de cobranzas. */
export interface Factura {
  id: string;
  cliente_id: string;
  sucursal_id: string | null;
  oportunidad_id: string | null;
  ot_id: string | null;
  tipo: "venta" | "servicio" | "consumible" | "repuesto";
  numero: string;
  fecha: string;
  vencimiento: string | null;
  monto: number | null;
  moneda: string;
  cobro_estado: "pendiente" | "prometido" | "sin_respuesta" | "cobrado";
  promesa_fecha: string | null;
  cobrado_at: string | null;
  condicion_aprobada_por: string | null;
  condicion_aprobada_at: string | null;
  condicion_nota: string | null;
  ultimo_reclamo_at: string | null;
  nota: string | null;
  created_at: string;
}

/** Caso de postventa (reclamo): primer nivel del vendedor, derivación a servicio. */
export interface Caso {
  id: string;
  numero: number;
  cliente_id: string;
  sucursal_id: string | null;
  equipo_id: string | null;
  responsable_id: string | null;
  abierto_por: string | null;
  prioridad: "parado" | "anda_mal" | "consulta";
  descripcion: string;
  estado: "abierto" | "derivado" | "cerrado";
  primera_respuesta_at: string | null;
  derivado_at: string | null;
  ot_id: string | null;
  cerrado_at: string | null;
  causa: string | null;
  solucion: string | null;
  created_at: string;
}

/** Técnico aliado (tercero) que trabaja fuera de la zona del técnico propio. */
export interface TecnicoAliado {
  id: string;
  nombre: string;
  zona: string | null;
  telefono: string | null;
  email: string | null;
  tarifa: string | null;
  notas: string | null;
  activo: boolean;
}
