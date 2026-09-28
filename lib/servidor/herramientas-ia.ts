import { ETAPAS, ETAPAS_ABIERTAS, ESTADOS_OT, PEDIDO_ESTADOS } from "@/lib/constants";
import { clasificarFacturas, diasDeAtraso } from "@/lib/cobranzas";
import { buscarTareas } from "@/lib/guia";
import { esGestor, veTodo } from "@/lib/puestos";
import { cargarCasos } from "@/lib/servidor/casos";
import { cargarMiDia } from "@/lib/servidor/midia";
import { atrasadasMias, cargarAgenda } from "@/lib/servidor/agenda";
import { horario, masDias, nombreTipo } from "@/lib/agenda";
import { calcularTablero, cargarDatosTablero, rangoPeriodo, type Db } from "@/lib/tablero";
import { buscarClientes } from "@/lib/actions/contactos";
import type { HerramientaIA } from "@/lib/core/ia";
import type { SupabaseServidor } from "@/lib/actions/comun";

/**
 * Herramientas de SOLO LECTURA del asistente. Todas consultan con la sesión
 * de quien pregunta: la base (RLS) decide qué puede ver cada puesto. Las
 * respuestas son acotadas (listas cortas) y traen el link a la pantalla.
 */

const etapa = (e: string) => ETAPAS.find((x) => x.value === e)?.label ?? e;
const pasoVenta = (e: string | null) => PEDIDO_ESTADOS.find((x) => x.value === (e ?? "comprometido"))?.label ?? e;
const estadoOT = (e: string) => ESTADOS_OT.find((x) => x.value === e)?.label ?? e;
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function herramientasAsistente(
  supabase: SupabaseServidor,
  usuario: { id: string; rol: string },
  hoy: string,
  ahora: number
): HerramientaIA[] {
  const lista: HerramientaIA[] = [
    {
      nombre: "mi_dia",
      etiqueta: "Mirando tu Mi día",
      descripcion:
        "Lo que la persona tiene pendiente hoy según su puesto (bandejas de Mi día): consultas, casos, ventas, cobranzas, remitos, etc. Usala para '¿qué tengo que hacer hoy?' o '¿qué me falta?'.",
      parametros: { type: "object", properties: {} },
      ejecutar: async () => {
        const b = await cargarMiDia(supabase, { rol: usuario.rol, userId: usuario.id, hoy, ahora });
        return b
          .filter((x) => x.cantidad > 0)
          .map((x) => ({ bandeja: x.titulo, ayuda: x.ayuda, cantidad: x.cantidad, link: x.href, primeros: x.items.map((i) => ({ que: i.titulo, detalle: i.detalle, link: i.href })) }));
      },
    },
    {
      nombre: "buscar_contactos",
      etiqueta: "Buscando contactos",
      descripcion: "Busca contactos (clientes o interesados) por nombre, empresa, teléfono, CUIT, email o número de serie de un equipo.",
      parametros: { type: "object", properties: { texto: { type: "string", description: "Lo que se busca" } }, required: ["texto"] },
      ejecutar: async (a) => {
        const r = await buscarClientes(texto(a.texto));
        return r.slice(0, 8).map((c) => ({
          cliente_id: c.id,
          nombre: c.nombre_comercial,
          estado: c.estado === "cliente_activo" ? "cliente" : "interesado",
          telefono: c.telefono,
          ciudad: c.ciudad ?? null,
          link: `/clientes/${c.id}`,
        }));
      },
    },
    {
      nombre: "ficha_contacto",
      etiqueta: "Leyendo la ficha",
      descripcion:
        "Todo sobre un contacto: datos, intereses abiertos, ventas, equipos con garantía, casos abiertos, facturas impagas y los últimos movimientos. Necesita el cliente_id (buscalo antes con buscar_contactos).",
      parametros: { type: "object", properties: { cliente_id: { type: "string" } }, required: ["cliente_id"] },
      ejecutar: async (a) => {
        const id = texto(a.cliente_id);
        const [{ data: c }, { data: opps }, { data: equipos }, { data: casos }, { data: facturas }, { data: movs }, { data: usuarios }, { data: personas }] = await Promise.all([
          supabase.from("clientes").select("id, nombre_comercial, razon_social, cuit, rubro, telefono, email, estado, comercial_id, notas").eq("id", id).maybeSingle(),
          supabase
            .from("oportunidades")
            .select("id, etapa, linea, pedido_estado, monto_estimado, moneda, proximo_contacto, proximo_nota, proxima_accion, mensaje_inicial, forma_pago, created_at, closed_at, producto:productos(nombre)")
            .eq("cliente_id", id)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(15),
          supabase.from("equipos").select("numero_serie, garantia_hasta, fecha_instalacion, marca_modelo_libre, producto:productos(nombre)").eq("cliente_id", id).is("deleted_at", null).limit(10),
          supabase.from("casos").select("numero, prioridad, descripcion, estado, created_at").eq("cliente_id", id).neq("estado", "cerrado").limit(5),
          supabase.from("facturas").select("numero, tipo, monto, moneda, vencimiento, cobro_estado").eq("cliente_id", id).neq("cobro_estado", "cobrado").limit(10),
          supabase.from("actividades").select("contenido, medio, resultado, created_at, created_by").eq("cliente_id", id).order("created_at", { ascending: false }).limit(12),
          supabase.from("usuarios").select("id, nombre"),
          supabase.from("contactos").select("nombre, cargo, telefono, email, es_decisor").eq("cliente_id", id).is("deleted_at", null).limit(10),
        ]);
        if (!c) return { error: "No se encontró el contacto o no lo podés ver." };
        const nombre = new Map(((usuarios ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre]));
        type Opp = { id: string; etapa: string; pedido_estado: string | null; monto_estimado: number | null; moneda: string; proximo_contacto: string | null; proximo_nota: string | null; mensaje_inicial: string | null; forma_pago: string | null; producto: { nombre: string } | null };
        const lista = (opps ?? []) as unknown as Opp[];
        return {
          contacto: { ...c, vendedor: c.comercial_id ? nombre.get(c.comercial_id) ?? null : null, link: `/clientes/${c.id}` },
          personas: personas ?? [],
          intereses_abiertos: lista
            .filter((o) => (ETAPAS_ABIERTAS as readonly string[]).includes(o.etapa))
            .map((o) => ({ que: o.producto?.nombre ?? o.mensaje_inicial, etapa: etapa(o.etapa), monto: o.monto_estimado, moneda: o.moneda, proximo_contacto: o.proximo_contacto, nota: o.proximo_nota, link: `/clientes/${c.id}?interes=${o.id}` })),
          ventas: lista.filter((o) => o.etapa === "ganada").map((o) => ({ que: o.producto?.nombre ?? o.mensaje_inicial, paso: pasoVenta(o.pedido_estado), monto: o.monto_estimado, moneda: o.moneda, forma_pago: o.forma_pago })),
          equipos: (equipos ?? []).map((e) => ({ modelo: (e.producto as unknown as { nombre: string } | null)?.nombre ?? e.marca_modelo_libre, serie: e.numero_serie, garantia_hasta: e.garantia_hasta, instalado: e.fecha_instalacion })),
          casos_abiertos: casos ?? [],
          facturas_impagas: ((facturas ?? []) as { numero: string; tipo: string; monto: number | null; moneda: string; vencimiento: string | null; cobro_estado: string }[]).map((f) => ({ ...f, dias_de_atraso: diasDeAtraso(f.vencimiento, hoy) })),
          ultimos_movimientos: ((movs ?? []) as { contenido: string | null; created_at: string; created_by: string | null }[]).map((m) => ({ fecha: m.created_at.slice(0, 10), quien: m.created_by ? nombre.get(m.created_by) ?? null : null, que: m.contenido })),
        };
      },
    },
    {
      nombre: "mis_intereses",
      etiqueta: "Revisando intereses abiertos",
      descripcion:
        "Intereses (consultas) abiertos de la persona, o de todos si ve todo: etapa, próximo contacto, días sin movimiento, monto. Sirve para priorizar, encontrar propuestas sin seguimiento o atrasados.",
      parametros: {
        type: "object",
        properties: {
          etapa: { type: "string", enum: ["nueva", "cotizada", "seguimiento", "espera"], description: "Filtrar por etapa (opcional)" },
          todos: { type: "boolean", description: "true = de todo el equipo (solo si el puesto ve todo)" },
        },
      },
      ejecutar: async (a) => {
        let q = supabase
          .from("oportunidades")
          .select("id, cliente_id, etapa, monto_estimado, moneda, proximo_contacto, proximo_nota, ultimo_movimiento_at, mensaje_inicial, comercial_id, producto:productos(nombre), cliente:clientes!inner(nombre_comercial, deleted_at)")
          .in("etapa", a.etapa ? [texto(a.etapa)] : [...ETAPAS_ABIERTAS])
          .is("cliente.deleted_at", null)
          .order("ultimo_movimiento_at", { ascending: true })
          .limit(40);
        if (!(a.todos && veTodo(usuario.rol))) q = q.eq("comercial_id", usuario.id);
        const { data } = await q;
        return ((data ?? []) as unknown as { id: string; cliente_id: string; etapa: string; monto_estimado: number | null; moneda: string; proximo_contacto: string | null; proximo_nota: string | null; ultimo_movimiento_at: string; mensaje_inicial: string | null; producto: { nombre: string } | null; cliente: { nombre_comercial: string } | null }[]).map((o) => ({
          contacto: o.cliente?.nombre_comercial,
          que: o.producto?.nombre ?? o.mensaje_inicial,
          etapa: etapa(o.etapa),
          monto: o.monto_estimado,
          moneda: o.moneda,
          proximo_contacto: o.proximo_contacto,
          nota: o.proximo_nota,
          dias_sin_movimiento: Math.floor((ahora - Date.parse(o.ultimo_movimiento_at)) / 86400000),
          link: `/clientes/${o.cliente_id}?interes=${o.id}`,
        }));
      },
    },
    {
      nombre: "catalogo",
      etiqueta: "Consultando el catálogo",
      descripcion: "Productos activos con precio de lista, moneda, stock y descripción. Opcionalmente filtrados por texto.",
      parametros: { type: "object", properties: { texto: { type: "string", description: "Parte del nombre (opcional)" } } },
      ejecutar: async (a) => {
        let q = supabase.from("productos").select("nombre, categoria, precio_referencia, moneda, stock, garantia_meses, descripcion, video_url").eq("activo", true).order("nombre").limit(30);
        if (texto(a.texto)) q = q.ilike("nombre", `%${texto(a.texto)}%`);
        const { data } = await q;
        return (data ?? []).map((p) => ({ ...p, descripcion: (p.descripcion as string | null)?.slice(0, 300) ?? null }));
      },
    },
    {
      nombre: "ventas_en_curso",
      etiqueta: "Revisando ventas en curso",
      descripcion: "Ventas vendidas que todavía no se entregaron, con el paso en que están (para facturar, esperando cobro, a preparar, despachadas).",
      parametros: { type: "object", properties: {} },
      ejecutar: async () => {
        let q = supabase
          .from("oportunidades")
          .select("cliente_id, pedido_estado, forma_pago, monto_estimado, moneda, remito_nro, cliente:clientes(nombre_comercial), producto:productos(nombre)")
          .eq("etapa", "ganada")
          .neq("pedido_estado", "entregado")
          .is("deleted_at", null)
          .limit(60);
        if (!veTodo(usuario.rol)) q = q.eq("comercial_id", usuario.id);
        const { data } = await q;
        return ((data ?? []) as unknown as { cliente_id: string; pedido_estado: string | null; forma_pago: string | null; monto_estimado: number | null; moneda: string; remito_nro: string | null; cliente: { nombre_comercial: string } | null; producto: { nombre: string } | null }[]).map((v) => ({
          contacto: v.cliente?.nombre_comercial,
          que: v.producto?.nombre,
          paso: pasoVenta(v.pedido_estado),
          datos_de_venta_completos: Boolean(v.forma_pago),
          monto: v.monto_estimado,
          moneda: v.moneda,
          remito: v.remito_nro,
          link: `/clientes/${v.cliente_id}`,
        }));
      },
    },
    {
      nombre: "casos_abiertos",
      etiqueta: "Revisando casos",
      descripcion: "Casos de postventa (reclamos) abiertos, con prioridad y si tienen la respuesta vencida.",
      parametros: { type: "object", properties: {} },
      ejecutar: async () => {
        const casos = await cargarCasos(supabase, { abiertos: true, responsableId: veTodo(usuario.rol) ? null : usuario.id, ahora, hoy, limite: 40 });
        return casos.map((c) => ({
          caso: c.numero,
          contacto: c.cliente?.nombre_comercial,
          prioridad: c.prioridad,
          que_pasa: c.descripcion.slice(0, 200),
          estado: c.estado,
          respondido: Boolean(c.primera_respuesta_at),
          respuesta_vencida: c.plazo.respuestaVencida,
          responsable: c.responsable,
          link: "/casos",
        }));
      },
    },
    {
      nombre: "services",
      etiqueta: "Revisando services",
      descripcion: "Trabajos técnicos (services) abiertos o pendientes de control/facturación, con técnico, fecha y prioridad.",
      parametros: { type: "object", properties: {} },
      ejecutar: async () => {
        let q = supabase
          .from("ordenes_trabajo")
          .select("id, numero, estado, tipo, prioridad, fecha_programada, remito_nro, presupuesto_monto, cobro_ok_at, cliente:clientes(nombre_comercial), tecnico:usuarios!ordenes_trabajo_tecnico_id_fkey(nombre)")
          .not("estado", "in", "(cerrado,cancelado,facturado)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(40);
        if (usuario.rol === "tecnico") q = q.eq("tecnico_id", usuario.id);
        const { data } = await q;
        return ((data ?? []) as unknown as { id: string; numero: number; estado: string; tipo: string; prioridad: string; fecha_programada: string | null; remito_nro: string | null; presupuesto_monto: number | null; cobro_ok_at: string | null; cliente: { nombre_comercial: string } | null; tecnico: { nombre: string } | null }[]).map((o) => ({
          service: o.numero,
          contacto: o.cliente?.nombre_comercial,
          estado: estadoOT(o.estado),
          tipo: o.tipo,
          prioridad: o.prioridad,
          fecha: o.fecha_programada,
          tecnico: o.tecnico?.nombre ?? null,
          remito: o.remito_nro,
          espera_cobro: o.presupuesto_monto != null && !o.cobro_ok_at,
          link: `/servicio/${o.id}`,
        }));
      },
    },
    {
      nombre: "mi_agenda",
      etiqueta: "Mirando tu agenda",
      descripcion:
        "Tareas, reuniones, capacitaciones y pagos de la agenda de la persona (lo que tiene asignado), entre dos fechas, más lo atrasado. Usala para '¿qué reuniones tengo esta semana?', '¿cuándo vence el alquiler?', '¿qué tareas me asignaron?'. Con asignadas_por_mi=true devuelve lo que la persona asignó a otros y quién lo terminó.",
      parametros: {
        type: "object",
        properties: {
          desde: { type: "string", description: "YYYY-MM-DD (por defecto hoy)" },
          hasta: { type: "string", description: "YYYY-MM-DD (por defecto en 14 días)" },
          asignadas_por_mi: { type: "boolean" },
        },
      },
      ejecutar: async (a) => {
        const fecha = (v: unknown, def: string) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : def);
        const desde = fecha(a.desde, hoy);
        const hasta = fecha(a.hasta, masDias(desde, 14));
        const q = { yo: usuario.id, gestor: esGestor(usuario.rol) };
        const [items, atrasadas] = await Promise.all([
          cargarAgenda(supabase, q, { desde, hasta, alcance: a.asignadas_por_mi ? "asigne" : "mia" }),
          a.asignadas_por_mi ? Promise.resolve([]) : atrasadasMias(supabase, q, hoy),
        ]);
        const fila = (i: (typeof items)[number]) => ({
          que: i.titulo,
          tipo: nombreTipo(i.tipo),
          fecha: i.fecha,
          hora: horario(i.hora, i.hora_fin) || null,
          monto: i.tipo === "pago" && i.monto != null ? `${i.moneda} ${i.monto}` : null,
          donde: i.lugar,
          personas: i.personas.map((p) => `${p.nombre}${p.hecha_at ? " (hecha)" : ""}`),
          hecha_por_mi: i.hechaYo,
          link: `/tareas/${i.id}`,
        });
        return { atrasadas: atrasadas.map(fila), agenda: items.map(fila), nueva: "/tareas/nueva", todo: "/tareas" };
      },
    },
    {
      nombre: "como_se_hace",
      etiqueta: "Buscando en la guía",
      descripcion: "Cómo se hace algo en GastroWare OS (pasos de la guía de uso con links). Usala para preguntas de uso del sistema: '¿cómo facturo?', '¿cómo cierro un service?'.",
      parametros: { type: "object", properties: { pregunta: { type: "string" } }, required: ["pregunta"] },
      ejecutar: async (a) =>
        buscarTareas(texto(a.pregunta)).map((t) => ({
          tarea: t.titulo,
          pasos: t.pasos.map((p) => p.texto + (p.href ? ` [${p.boton ?? "Ir"}](${p.href})` : "")),
          ojo: t.ojo ?? null,
          guia: `/guia?tarea=${t.id}`,
        })),
    },
  ];

  if (veTodo(usuario.rol)) {
    lista.push({
      nombre: "cobranzas",
      etiqueta: "Revisando cobranzas",
      descripcion: "Facturas para cobrar: vencidas (con días de atraso), vencen hoy, en 48 h y promesas de pago.",
      parametros: { type: "object", properties: {} },
      ejecutar: async () => {
        const { data } = await supabase
          .from("facturas")
          .select("id, numero, tipo, monto, moneda, vencimiento, cobro_estado, promesa_fecha, cliente_id, cliente:clientes(nombre_comercial)")
          .neq("cobro_estado", "cobrado")
          .limit(1000);
        type F = { id: string; numero: string; tipo: string; monto: number | null; moneda: string; vencimiento: string | null; cobro_estado: string; promesa_fecha: string | null; cliente_id: string; cliente: { nombre_comercial: string } | null };
        const g = clasificarFacturas((data ?? []) as unknown as F[], hoy);
        const fila = (f: F) => ({ contacto: f.cliente?.nombre_comercial, factura: f.numero, tipo: f.tipo, monto: f.monto, moneda: f.moneda, vence: f.vencimiento, dias_de_atraso: diasDeAtraso(f.vencimiento, hoy), estado: f.cobro_estado, promesa: f.promesa_fecha });
        return {
          vencidas: g.vencidas.slice(0, 20).map(fila),
          vencen_hoy: g.hoy.map(fila),
          vencen_48h: g.en48.map(fila),
          prometidas: g.prometidas.map(fila),
          totales: { vencidas: g.vencidas.length, hoy: g.hoy.length, en_48h: g.en48.length, prometidas: g.prometidas.length, al_dia: g.alDia.length },
          link: "/cobranzas",
        };
      },
    });
  }

  if (esGestor(usuario.rol)) {
    lista.push({
      nombre: "numeros_del_periodo",
      etiqueta: "Leyendo el tablero",
      descripcion: "Números del negocio (tablero de dirección) para un período: vendido, abierto, ponderado, por vendedor, alertas. Solo dirección.",
      parametros: {
        type: "object",
        properties: { periodo: { type: "string", enum: ["mes", "mes_pasado", "trimestre", "anio", "semana_pasada"] } },
      },
      ejecutar: async (a) => {
        const per = rangoPeriodo((texto(a.periodo) || "mes") as Parameters<typeof rangoPeriodo>[0], hoy);
        const datos = await cargarDatosTablero(supabase as unknown as Db, per, ahora);
        const t = calcularTablero(datos, per, {}, hoy, ahora);
        return {
          periodo: per.etiqueta,
          comparado_con: per.etiquetaAnt,
          negocio: t.negocio,
          embudo: t.embudo,
          ciclo_de_venta_dias: t.ciclo,
          por_vendedor: t.vendedores,
          por_producto: t.porProducto,
          por_origen: t.porOrigen,
          motivos_no_se_dio: t.motivos,
          alertas: t.alertas,
          link: "/tablero",
        };
      },
    });
  }
  return lista;
}
