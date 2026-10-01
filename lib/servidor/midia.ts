import { ETAPAS_ABIERTAS } from "@/lib/constants";
import { clasificarFacturas } from "@/lib/cobranzas";
import { transcurrido } from "@/lib/habiles";
import { lunesDe } from "@/lib/semana";
import { esGestor, factura, controlaServicio } from "@/lib/puestos";
import { cargarCasos } from "@/lib/servidor/casos";
import type { SupabaseServidor } from "@/lib/actions/comun";

/**
 * "Mi día" por puesto (docs/MODELO-OPERATIVO.md, sección 3): cada uno ve al
 * abrir lo que le toca hacer hoy, en bandejas. Cada bandeja lleva a la
 * pantalla donde se resuelve.
 */

export type ItemBandeja = { id: string; titulo: string; detalle?: string | null; href: string };
export type Bandeja = {
  clave: string;
  titulo: string;
  ayuda?: string;
  cantidad: number;
  href: string;
  tono: "rojo" | "ambar" | "azul" | "verde" | "violeta" | "gris";
  items: ItemBandeja[];
};

type Opp = {
  id: string;
  cliente_id: string;
  asignado_at?: string | null;
  pedido_estado?: string | null;
  prioridad_despacho?: number | null;
  remito_nro?: string | null;
  cliente: { nombre_comercial: string } | null;
  producto: { nombre: string } | null;
  mensaje_inicial?: string | null;
};

const nombreOpp = (o: Opp) => o.cliente?.nombre_comercial ?? "Contacto";
const queOpp = (o: Opp) => o.producto?.nombre ?? o.mensaje_inicial ?? "";
const fichaOpp = (o: Opp) => `/clientes/${o.cliente_id}?interes=${o.id}`;
const MAX = 6;

function bandeja(b: Omit<Bandeja, "items" | "cantidad"> & { lista: ItemBandeja[]; cantidad?: number }): Bandeja {
  return { ...b, cantidad: b.cantidad ?? b.lista.length, items: b.lista.slice(0, MAX) };
}

const COLS_OPP = "id, cliente_id, asignado_at, pedido_estado, prioridad_despacho, remito_nro, mensaje_inicial, cliente:clientes!inner(nombre_comercial, deleted_at), producto:productos(nombre)";

export async function cargarMiDia(
  supabase: SupabaseServidor,
  opciones: { rol: string; userId: string; hoy: string; ahora: number }
): Promise<Bandeja[]> {
  const { rol, userId, hoy, ahora } = opciones;
  const bandejas: Bandeja[] = [];
  const vendedor = rol === "comercial" || rol === "direccion";
  const administra = factura(rol);
  const controla = controlaServicio(rol);

  // --- Consumibles: reposiciones a mi cargo para contactar (hoy o atrasadas) ---
  {
    const { data } = await supabase
      .from("recurrencias")
      .select("id, cliente_id, proxima_alerta, cliente:clientes!inner(nombre_comercial, deleted_at), producto:productos(nombre)")
      .eq("responsable_id", userId)
      .eq("activa", true)
      .lte("proxima_alerta", hoy)
      .is("cliente.deleted_at", null)
      .order("proxima_alerta")
      .limit(100);
    const filas = (data ?? []) as unknown as { id: string; cliente_id: string; proxima_alerta: string; cliente: { nombre_comercial: string } | null; producto: { nombre: string } | null }[];
    if (filas.length)
      bandejas.push(
        bandeja({
          clave: "reposiciones",
          titulo: "Consumibles: reposiciones para contactar",
          ayuda: "No se manda nada solo: contactalo y registrá la venta o reprogramá",
          href: "/consumibles?quien=mios",
          tono: filas.some((f) => f.proxima_alerta < hoy) ? "ambar" : "verde",
          lista: filas.map((f) => ({
            id: f.id,
            titulo: f.cliente?.nombre_comercial ?? "Cliente",
            detalle: `${f.producto?.nombre ?? "Consumible"}${f.proxima_alerta < hoy ? ` · desde el ${f.proxima_alerta.split("-").reverse().slice(0, 2).join("/")}` : ""}`,
            href: "/consumibles?quien=mios",
          })),
        })
      );
  }

  // --- Repuestos: para validar (a quien le toca) y para cotizar (su vendedor) ---
  {
    const [{ data: validar }, { data: cotizar }] = await Promise.all([
      supabase
        .from("solicitudes_repuesto")
        .select("oportunidad_id, descripcion, cliente:clientes(nombre_comercial)")
        .eq("validador_id", userId)
        .eq("validacion", "pendiente")
        .limit(50),
      supabase
        .from("solicitudes_repuesto")
        .select("oportunidad_id, cliente_id, descripcion, validacion, cliente:clientes(nombre_comercial), opp:oportunidades!inner(etapa, comercial_id, deleted_at)")
        .neq("validacion", "pendiente")
        .eq("opp.etapa", "nueva")
        .eq("opp.comercial_id", userId)
        .is("opp.deleted_at", null)
        .limit(50),
    ]);
    type Sol = { oportunidad_id: string; cliente_id?: string; descripcion: string; cliente: { nombre_comercial: string } | null };
    const v = (validar ?? []) as unknown as Sol[];
    const c = (cotizar ?? []) as unknown as Sol[];
    if (v.length)
      bandejas.push(
        bandeja({
          clave: "repuestos_validar",
          titulo: "Repuestos para validar",
          ayuda: "Confirmá qué pieza es para que el vendedor cotice",
          href: "/repuestos?ver=validar",
          tono: "violeta",
          lista: v.map((s) => ({ id: s.oportunidad_id, titulo: s.cliente?.nombre_comercial ?? "Cliente", detalle: s.descripcion, href: "/repuestos?ver=validar" })),
        })
      );
    if (c.length)
      bandejas.push(
        bandeja({
          clave: "repuestos_cotizar",
          titulo: "Repuestos para cotizar",
          ayuda: "Precio, disponibilidad y plazo",
          href: "/repuestos?quien=mias",
          tono: "ambar",
          lista: c.map((s) => ({ id: s.oportunidad_id, titulo: s.cliente?.nombre_comercial ?? "Cliente", detalle: s.descripcion, href: "/repuestos?quien=mias" })),
        })
      );
  }

  // --- Consultas (entrada) ---
  if (vendedor) {
    const { data } = await supabase
      .from("oportunidades")
      .select(COLS_OPP)
      .eq("comercial_id", userId)
      .in("etapa", [...ETAPAS_ABIERTAS])
      .not("asignado_at", "is", null)
      .is("primer_contacto_at", null)
      .is("cliente.deleted_at", null)
      .order("asignado_at")
      .limit(50);
    const lista = ((data ?? []) as unknown as Opp[]).map((o) => ({
      id: o.id,
      titulo: nombreOpp(o),
      detalle: `${queOpp(o)} · asignada ${o.asignado_at ? transcurrido(o.asignado_at, ahora) : ""}`,
      href: fichaOpp(o),
    }));
    bandejas.push(
      bandeja({ clave: "primer_contacto", titulo: "Consultas sin primer contacto", ayuda: "Dentro de la hora", href: "/hoy", tono: "rojo", lista })
    );
  }
  if (rol === "administrativa" || esGestor(rol)) {
    const { data } = await supabase
      .from("oportunidades")
      .select(COLS_OPP)
      .is("comercial_id", null)
      .in("etapa", [...ETAPAS_ABIERTAS])
      .is("cliente.deleted_at", null)
      .order("created_at")
      .limit(50);
    const lista = ((data ?? []) as unknown as Opp[]).map((o) => ({ id: o.id, titulo: nombreOpp(o), detalle: queOpp(o), href: fichaOpp(o) }));
    bandejas.push(
      bandeja({ clave: "sin_asignar", titulo: "Consultas por asignar", ayuda: "Cargá dónde se entrega", href: "/hoy", tono: "rojo", lista })
    );
  }

  // --- Dirección general: aprobaciones e informes ---
  if (rol === "direccion") {
    const [{ data: props }, { data: infs }] = await Promise.all([
      supabase
        .from("cotizacion_versiones")
        .select("id, total, moneda, cotizacion:cotizaciones(oportunidad:oportunidades(cliente:clientes(nombre_comercial)))")
        .eq("aprobacion", "pendiente")
        .limit(50),
      supabase.from("informes_semanales").select("id, usuario_id").eq("semana", lunesDe(hoy)).not("enviado_at", "is", null).is("respondido_at", null),
    ]);
    const lista = ((props ?? []) as unknown as { id: string; cotizacion: { oportunidad: { cliente: { nombre_comercial: string } | null } | null } | null }[]).map(
      (p) => ({ id: p.id, titulo: p.cotizacion?.oportunidad?.cliente?.nombre_comercial ?? "Propuesta", href: "/aprobaciones" })
    );
    bandejas.push(bandeja({ clave: "aprobaciones", titulo: "Propuestas para aprobar", ayuda: "El mismo día", href: "/aprobaciones", tono: "violeta", lista }));
    // v1.15: lo que carga marketing en el calendario
    const { data: conts } = await supabase.from("contenidos").select("id, nombre, fecha").eq("estado", "pendiente").order("fecha").limit(50);
    bandejas.push(
      bandeja({
        clave: "contenidos_aprobar",
        titulo: "Contenidos para aprobar",
        ayuda: "Calendario de marketing",
        href: "/aprobaciones",
        tono: "violeta",
        lista: ((conts ?? []) as { id: string; nombre: string; fecha: string }[]).map((c) => ({ id: c.id, titulo: c.nombre, href: "/aprobaciones" })),
      })
    );
    bandejas.push(
      bandeja({
        clave: "informes",
        titulo: "Informes para responder",
        href: "/informes",
        tono: "azul",
        lista: ((infs ?? []) as { id: string }[]).map((i) => ({ id: i.id, titulo: "Informe semanal", href: "/informes" })),
      })
    );
  }

  // --- Vendedor: casos, ventas sin datos, entregas, postventa, informe ---
  if (vendedor) {
    const casos = await cargarCasos(supabase, { abiertos: true, responsableId: userId, ahora, hoy, limite: 50 });
    bandejas.push(
      bandeja({
        clave: "casos",
        titulo: "Casos de postventa",
        ayuda: "Responder en 24 h hábiles",
        href: "/casos",
        tono: casos.some((c) => c.plazo.respuestaVencida || c.prioridad === "parado") ? "rojo" : "ambar",
        lista: casos.map((c) => ({
          id: c.id,
          titulo: c.cliente?.nombre_comercial ?? "Cliente",
          detalle: `${c.prioridad === "parado" ? "PARADO · " : ""}${c.primera_respuesta_at ? "en curso" : "sin respuesta"}`,
          href: "/casos",
        })),
      })
    );
    const [{ data: sinDatos }, { data: porEntregar }, { data: postventa }] = await Promise.all([
      supabase
        .from("oportunidades")
        .select(COLS_OPP)
        .eq("comercial_id", userId)
        .eq("etapa", "ganada")
        .eq("pedido_estado", "comprometido")
        .is("forma_pago", null)
        .limit(30),
      supabase.from("oportunidades").select(COLS_OPP).eq("comercial_id", userId).eq("etapa", "ganada").eq("pedido_estado", "despachado").limit(30),
      supabase
        .from("tareas")
        .select("id, titulo, cliente_id, vence_el, cliente:clientes(nombre_comercial)")
        .eq("usuario_id", userId)
        .eq("tipo", "postventa")
        .is("completada_at", null)
        .eq("cancelada", false)
        .lte("vence_el", hoy)
        .order("vence_el")
        .limit(30),
    ]);
    bandejas.push(
      bandeja({
        clave: "ventas_sin_datos",
        titulo: "Ventas: completar datos",
        ayuda: "Pago, entrega e instalación para facturar",
        href: "/pedidos",
        tono: "ambar",
        lista: ((sinDatos ?? []) as unknown as Opp[]).map((o) => ({ id: o.id, titulo: nombreOpp(o), detalle: queOpp(o), href: `/clientes/${o.cliente_id}` })),
      })
    );
    bandejas.push(
      bandeja({
        clave: "por_entregar",
        titulo: "Despachadas: confirmar entrega",
        href: "/pedidos",
        tono: "azul",
        lista: ((porEntregar ?? []) as unknown as Opp[]).map((o) => ({ id: o.id, titulo: nombreOpp(o), detalle: queOpp(o), href: `/clientes/${o.cliente_id}` })),
      })
    );
    bandejas.push(
      bandeja({
        clave: "postventa",
        titulo: "Postventa del día",
        ayuda: "Días 2, 10 y 30",
        href: "/hoy",
        tono: "verde",
        lista: ((postventa ?? []) as unknown as { id: string; titulo: string; cliente_id: string; cliente: { nombre_comercial: string } | null }[]).map((t) => ({
          id: t.id,
          titulo: t.cliente?.nombre_comercial ?? "Cliente",
          detalle: t.titulo,
          href: `/clientes/${t.cliente_id}`,
        })),
      })
    );
    if (rol === "comercial") {
      const { data: inf } = await supabase.from("informes_semanales").select("enviado_at, respondido_at").eq("usuario_id", userId).eq("semana", lunesDe(hoy)).maybeSingle();
      if (!inf?.enviado_at)
        bandejas.push(
          bandeja({
            clave: "informe",
            titulo: "Mandá el informe de la semana",
            ayuda: "Los lunes antes de las 10",
            href: "/informe",
            tono: "violeta",
            lista: [{ id: "informe", titulo: "Informe comercial", detalle: "Los números los pone el CRM", href: "/informe" }],
          })
        );
    }
  }

  // --- Administración: facturar, cobrar, preparar, despachar ---
  // La administrativa hace el circuito; dirección de administración controla cobranza y condiciones
  if (administra && rol !== "direccion") {
    const esAdministrativa = rol === "administrativa";
    const [{ data: facturar }, { data: cobro }, { data: preparar }, { data: remitos }, { data: facts }, { data: recompras }] = await Promise.all([
      supabase.from("oportunidades").select(COLS_OPP).eq("etapa", "ganada").eq("pedido_estado", "comprometido").not("forma_pago", "is", null).limit(50),
      supabase.from("oportunidades").select(COLS_OPP).eq("etapa", "ganada").eq("pedido_estado", "facturado").limit(50),
      supabase.from("oportunidades").select(COLS_OPP).eq("etapa", "ganada").eq("pedido_estado", "preparar_envio").order("prioridad_despacho", { nullsFirst: false }).limit(50),
      supabase.from("ordenes_trabajo").select("id, numero, cliente:clientes(nombre_comercial)").eq("estado", "aprobado_facturar").limit(50),
      supabase.from("facturas").select("id, vencimiento, cobro_estado, promesa_fecha, numero, cliente:clientes(nombre_comercial)").neq("cobro_estado", "cobrado").limit(1000),
      supabase
        .from("tareas")
        .select("id, titulo, cliente_id, cliente:clientes(nombre_comercial)")
        .eq("tipo", "recompra")
        .is("completada_at", null)
        .eq("cancelada", false)
        .lte("vence_el", hoy)
        .limit(50),
    ]);
    const aItem = (o: Opp, detalle?: string) => ({ id: o.id, titulo: nombreOpp(o), detalle: detalle ?? queOpp(o), href: `/clientes/${o.cliente_id}` });
    if (esAdministrativa) bandejas.push(bandeja({ clave: "facturar", titulo: "Ventas para facturar", ayuda: "El mismo día", href: "/pedidos", tono: "ambar", lista: ((facturar ?? []) as unknown as Opp[]).map((o) => aItem(o)) }));
    bandejas.push(bandeja({ clave: "cobro", titulo: "Facturadas: registrar cobro", ayuda: "Sin cobro no se prepara", href: "/pedidos", tono: "violeta", lista: ((cobro ?? []) as unknown as Opp[]).map((o) => aItem(o)) }));
    if (esAdministrativa) bandejas.push(
      bandeja({
        clave: "preparar",
        titulo: "Preparar y despachar",
        ayuda: "Remito, prioridad y videos del modelo",
        href: "/pedidos",
        tono: "azul",
        lista: ((preparar ?? []) as unknown as Opp[]).map((o) => aItem(o, `${queOpp(o)}${o.prioridad_despacho === 1 ? " · URGENTE" : ""}${o.remito_nro ? "" : " · sin remito"}`)),
      })
    );
    if (esAdministrativa) bandejas.push(
      bandeja({
        clave: "remitos_facturar",
        titulo: "Remitos de service para facturar",
        ayuda: "Al día siguiente del control",
        href: "/servicio",
        tono: "violeta",
        lista: ((remitos ?? []) as unknown as { id: string; numero: number; cliente: { nombre_comercial: string } | null }[]).map((o) => ({
          id: o.id,
          titulo: o.cliente?.nombre_comercial ?? "Cliente",
          detalle: `Service ${o.numero}`,
          href: `/servicio/${o.id}`,
        })),
      })
    );
    const g = clasificarFacturas((facts ?? []) as unknown as { id: string; vencimiento: string | null; cobro_estado: string; promesa_fecha: string | null; numero: string; cliente: { nombre_comercial: string } | null }[], hoy);
    const cobrar = [...g.vencidas, ...g.hoy, ...g.en48];
    bandejas.push(
      bandeja({
        clave: "cobranzas",
        titulo: "Cobranzas de hoy",
        ayuda: `${g.vencidas.length} vencidas · ${g.hoy.length} vencen hoy · ${g.en48.length} en 48 h`,
        href: "/cobranzas",
        tono: g.vencidas.length ? "rojo" : "ambar",
        lista: cobrar.map((f) => ({ id: f.id, titulo: f.cliente?.nombre_comercial ?? "Cliente", detalle: `Factura ${f.numero}`, href: "/cobranzas" })),
      })
    );
    if (esAdministrativa)
      bandejas.push(
        bandeja({
          clave: "recompras",
          titulo: "Recontactos de consumibles",
          href: "/hoy",
          tono: "verde",
          lista: ((recompras ?? []) as unknown as { id: string; titulo: string; cliente_id: string; cliente: { nombre_comercial: string } | null }[]).map((t) => ({
            id: t.id,
            titulo: t.cliente?.nombre_comercial ?? "Cliente",
            detalle: t.titulo,
            href: `/clientes/${t.cliente_id}`,
          })),
        })
      );
  }

  // --- Control de servicio técnico ---
  if (controla && rol !== "direccion") {
    const [{ data: sinAsignar }, { data: control }, { data: garantias }] = await Promise.all([
      supabase
        .from("ordenes_trabajo")
        .select("id, numero, prioridad, cliente:clientes(nombre_comercial)")
        .in("estado", ["solicitud_recibida", "pendiente_revision", "pendiente_asignacion"])
        .is("tecnico_id", null)
        .is("aliado_id", null)
        .is("deleted_at", null)
        .limit(50),
      supabase.from("ordenes_trabajo").select("id, numero, cliente:clientes(nombre_comercial)").in("estado", ["finalizado_tecnico", "revision_admin"]).limit(50),
      supabase.from("ordenes_trabajo").select("id, numero, garantia_reclamo, cliente:clientes(nombre_comercial)").in("garantia_reclamo", ["a_presentar", "presentado", "repuesto_recibido"]).limit(50),
    ]);
    type OTm = { id: string; numero: number; prioridad?: string; garantia_reclamo?: string; cliente: { nombre_comercial: string } | null };
    const casos = await cargarCasos(supabase, { abiertos: true, ahora, hoy, limite: 100 });
    const parados = casos.filter((c) => c.plazo.paradoSinTecnico);
    bandejas.push(
      bandeja({
        clave: "parados",
        titulo: "Equipos parados sin técnico (24 h)",
        href: "/casos",
        tono: "rojo",
        lista: parados.map((c) => ({ id: c.id, titulo: c.cliente?.nombre_comercial ?? "Cliente", detalle: `Caso ${c.numero}`, href: "/casos" })),
      })
    );
    bandejas.push(
      bandeja({
        clave: "ot_asignar",
        titulo: "Services para asignar",
        ayuda: "Técnico propio o aliado según la zona",
        href: "/servicio",
        tono: "ambar",
        lista: ((sinAsignar ?? []) as unknown as OTm[]).map((o) => ({
          id: o.id,
          titulo: o.cliente?.nombre_comercial ?? "Cliente",
          detalle: `Service ${o.numero}${o.prioridad === "urgente" ? " · PARADO" : ""}`,
          href: `/servicio/${o.id}`,
        })),
      })
    );
    bandejas.push(
      bandeja({
        clave: "remitos_control",
        titulo: "Remitos para controlar",
        href: "/servicio",
        tono: "violeta",
        lista: ((control ?? []) as unknown as OTm[]).map((o) => ({ id: o.id, titulo: o.cliente?.nombre_comercial ?? "Cliente", detalle: `Service ${o.numero}`, href: `/servicio/${o.id}` })),
      })
    );
    bandejas.push(
      bandeja({
        clave: "garantias",
        titulo: "Garantías con fábrica",
        href: "/servicio",
        tono: "azul",
        lista: ((garantias ?? []) as unknown as OTm[]).map((o) => ({ id: o.id, titulo: o.cliente?.nombre_comercial ?? "Cliente", detalle: `Service ${o.numero}`, href: `/servicio/${o.id}` })),
      })
    );
  }

  // --- Técnico: depósito y repuestos ---
  if (rol === "tecnico") {
    const [{ data: preparar }, { data: repuestos }, { data: esperaCobro }, { data: devueltos }] = await Promise.all([
      supabase.from("oportunidades").select(COLS_OPP).eq("etapa", "ganada").eq("pedido_estado", "preparar_envio").order("prioridad_despacho", { nullsFirst: false }).limit(50),
      supabase.from("repuestos").select("id, descripcion, stock, stock_minimo").eq("activo", true).not("stock_minimo", "is", null).limit(500),
      supabase
        .from("ordenes_trabajo")
        .select("id, numero, cliente:clientes(nombre_comercial)")
        .eq("tecnico_id", userId)
        .not("presupuesto_monto", "is", null)
        .is("cobro_ok_at", null)
        .in("estado", ["programado", "asignado"])
        .limit(30),
      supabase.from("ordenes_trabajo").select("id, numero, observacion_admin, cliente:clientes(nombre_comercial)").eq("tecnico_id", userId).eq("estado", "devuelto_tecnico").limit(30),
    ]);
    type OTm = { id: string; numero: number; observacion_admin?: string | null; cliente: { nombre_comercial: string } | null };
    bandejas.push(
      bandeja({
        clave: "devueltos",
        titulo: "Remitos devueltos para corregir",
        href: "/servicio",
        tono: "rojo",
        lista: ((devueltos ?? []) as unknown as OTm[]).map((o) => ({
          id: o.id,
          titulo: o.cliente?.nombre_comercial ?? "Cliente",
          detalle: o.observacion_admin ?? `Service ${o.numero}`,
          href: `/servicio/${o.id}`,
        })),
      })
    );
    bandejas.push(
      bandeja({
        clave: "preparar_deposito",
        titulo: "Preparar hoy en el depósito",
        ayuda: "Ya facturado y cobrado",
        href: "/pedidos",
        tono: "azul",
        lista: ((preparar ?? []) as unknown as Opp[]).map((o) => ({
          id: o.id,
          titulo: nombreOpp(o),
          detalle: `${queOpp(o)}${o.prioridad_despacho === 1 ? " · URGENTE" : ""}${o.remito_nro ? ` · remito ${o.remito_nro}` : ""}`,
          href: "/pedidos",
        })),
      })
    );
    bandejas.push(
      bandeja({
        clave: "espera_cobro",
        titulo: "Esperando cobro: no salir todavía",
        href: "/servicio",
        tono: "ambar",
        lista: ((esperaCobro ?? []) as unknown as OTm[]).map((o) => ({ id: o.id, titulo: o.cliente?.nombre_comercial ?? "Cliente", detalle: `Service ${o.numero}`, href: `/servicio/${o.id}` })),
      })
    );
    const bajos = ((repuestos ?? []) as { id: string; descripcion: string; stock: number | null; stock_minimo: number | null }[]).filter(
      (r) => r.stock_minimo != null && (r.stock ?? 0) <= r.stock_minimo
    );
    const viernes = new Date(hoy + "T12:00:00Z").getUTCDay() === 5;
    bandejas.push(
      bandeja({
        clave: "repuestos",
        titulo: viernes ? "Viernes: repuestos en el mínimo para reponer" : "Repuestos en el mínimo",
        href: "/stock",
        tono: viernes ? "ambar" : "gris",
        lista: bajos.map((r) => ({ id: r.id, titulo: r.descripcion, detalle: `stock ${r.stock ?? 0} · mínimo ${r.stock_minimo}`, href: "/stock" })),
      })
    );
  }

  // --- Marketing ---
  if (rol === "marketing") {
    const inicioMes = hoy.slice(0, 8) + "01";
    const [{ data: pedidos }, { data: sinVideo }, { data: canales }] = await Promise.all([
      supabase.from("pedidos_material").select("id, titulo, para_fecha").neq("estado", "entregado").order("para_fecha", { nullsFirst: false }).limit(50),
      supabase.from("productos").select("id, nombre").eq("activo", true).is("video_url", null).limit(200),
      supabase.from("oportunidades").select("origen").gte("created_at", `${inicioMes}T03:00:00.000Z`).limit(5000),
    ]);
    bandejas.push(
      bandeja({
        clave: "pedidos_material",
        titulo: "Pedidos de material",
        href: "/marketing/pedidos",
        tono: "ambar",
        lista: ((pedidos ?? []) as { id: string; titulo: string; para_fecha: string | null }[]).map((p) => ({
          id: p.id,
          titulo: p.titulo,
          detalle: p.para_fecha ? `para el ${p.para_fecha.split("-").reverse().join("/")}` : null,
          href: "/marketing/pedidos",
        })),
      })
    );
    bandejas.push(
      bandeja({
        clave: "sin_video",
        titulo: "Modelos sin video instructivo",
        href: "/marketing/videos",
        tono: "violeta",
        lista: ((sinVideo ?? []) as { id: string; nombre: string }[]).map((p) => ({ id: p.id, titulo: p.nombre, href: "/marketing/videos" })),
      })
    );
    const porCanal = new Map<string, number>();
    for (const o of (canales ?? []) as { origen: string | null }[]) porCanal.set(o.origen || "Otro", (porCanal.get(o.origen || "Otro") ?? 0) + 1);
    bandejas.push(
      bandeja({
        clave: "canales",
        titulo: "Consultas del mes por canal",
        href: "/movimientos",
        tono: "azul",
        cantidad: (canales ?? []).length,
        lista: [...porCanal.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ id: c, titulo: c, detalle: `${n} consultas`, href: "/movimientos" })),
      })
    );
  }

  return bandejas;
}
