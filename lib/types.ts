export type Etapa =
  | "nueva"
  | "diagnostico"
  | "cotizada"
  | "seguimiento"
  | "negociacion"
  | "ganada"
  | "perdida";

export interface Cliente {
  id: string;
  nombre_comercial: string;
  razon_social: string | null;
  rubro: string;
  ciudad: string | null;
  provincia: string | null;
  telefono: string | null;
  email: string | null;
  instagram_web: string | null;
  estado: "prospecto" | "cliente_activo" | "inactivo";
  potencial: string | null;
  vendedor_id: string | null;
  notas: string | null;
  created_at: string;
}

export interface Producto {
  id: string;
  nombre: string;
  marca: string | null;
  categoria: string;
  es_consumible: boolean;
  frecuencia_recompra_dias: number | null;
  consumible_de: string | null;
  precio_referencia: number | null;
  moneda: string;
  activo: boolean;
  garantia_meses: number | null;
}

export interface Oportunidad {
  id: string;
  cliente_id: string;
  producto_id: string | null;
  vendedor_id: string | null;
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
  created_at: string;
  closed_at: string | null;
  cliente?: Cliente;
  producto?: Producto | null;
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
  vendedor_id: string | null;
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

export interface Cotizacion {
  id: string;
  oportunidad_id: string;
  monto: number | null;
  moneda: string;
  archivo_url: string | null;
  forma_pago: string | null;
  validez_dias: number | null;
  enviada_at: string;
  notas: string | null;
}

export interface EquipoInstalado {
  id: string;
  cliente_id: string;
  producto_id: string | null;
  cantidad: number;
  fecha_compra: string | null;
  oportunidad_id: string | null;
  notas: string | null;
  numero_serie: string | null;
  marca_modelo: string | null;
  origen: "vendido" | "externo";
  garantia_hasta: string | null;
  proximo_service: string | null;
  producto?: Producto | null;
}

export interface Recurrencia {
  id: string;
  cliente_id: string;
  producto_id: string;
  frecuencia_dias: number;
  ultima_compra: string | null;
  proxima_alerta: string;
  activa: boolean;
  producto?: Producto;
}

export type EstadoOT =
  | "abierta"
  | "en_proceso"
  | "cerrada_tecnico"
  | "facturable"
  | "facturada"
  | "anulada";

export interface OrdenTrabajo {
  id: string;
  numero: number;
  cliente_id: string;
  equipo_id: string | null;
  tecnico_id: string | null;
  creado_por: string | null;
  estado: EstadoOT;
  tipo: "correctivo" | "preventivo" | "instalacion" | "garantia";
  es_garantia: boolean;
  fecha_programada: string | null;
  problema: string | null;
  trabajo_realizado: string | null;
  horas: number | null;
  firma_url: string | null;
  firmante: string | null;
  total: number | null;
  nro_factura: string | null;
  facturada_at: string | null;
  created_at: string;
  cerrada_at: string | null;
  cliente?: Cliente;
  equipo?: EquipoInstalado | null;
  tecnico?: { id: string; nombre: string } | null;
}

export interface OTItem {
  id: string;
  ot_id: string;
  tipo: "refaccion" | "gasto";
  descripcion: string;
  producto_id: string | null;
  cantidad: number;
  precio_unit: number;
  refacturable: boolean;
  comprobante_url: string | null;
}

export interface OTFoto {
  id: string;
  ot_id: string;
  url: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  rol: "admin" | "vendedor" | "tecnico";
  activo: boolean;
}

export interface Actividad {
  id: string;
  cliente_id: string;
  oportunidad_id: string | null;
  tipo: string;
  contenido: string | null;
  created_by: string | null;
  created_at: string;
}
