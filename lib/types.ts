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
  producto_id: string;
  cantidad: number;
  fecha_compra: string | null;
  oportunidad_id: string | null;
  notas: string | null;
  producto?: Producto;
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

export interface Actividad {
  id: string;
  cliente_id: string;
  oportunidad_id: string | null;
  tipo: string;
  contenido: string | null;
  created_by: string | null;
  created_at: string;
}
