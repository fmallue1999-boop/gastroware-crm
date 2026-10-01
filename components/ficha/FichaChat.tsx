import Link from "next/link";
import { notFound } from "next/navigation";
import { productosDeLinea } from "@/lib/precios";
import { Bell, ChevronLeft, FileText, Mail, Maximize2, MessageCircle, Phone, Wrench, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { firmarUrl, firmarUrls } from "@/lib/core/storage";
import { iaConfigurada } from "@/lib/core/ia";
import { infoStockPorProducto, textoStock } from "@/lib/stock";
import {
  fechaCorta,
  haceCuanto,
  linkWhatsApp,
  dinero,
  diasDesde,
  hoyISO,
  telefonoProlijo,
} from "@/lib/format";
import { ESTADOS_OT, ETAPAS_ABIERTAS } from "@/lib/constants";
import { datosFiscalesDe, faltanParaCotizar } from "@/lib/datos-cotizar";
import Compositor from "@/components/ficha/Compositor";
import PersonasCliente, { type Persona } from "@/components/ficha/PersonasCliente";
import TarjetaRepuesto from "@/components/repuestos/TarjetaRepuesto";
import { cargarSolicitudes } from "@/lib/servidor/repuestos";
import { nombreLinea, notasSinContacto, textoActividad } from "@/lib/actividad";
import { cantidadTexto, reposicionEstimada } from "@/lib/consumibles";
import InteresFijado, { type VersionCot } from "@/components/ficha/InteresFijado";
import FichaTabs, { IrAPestana, type Pestana } from "@/components/ficha/FichaTabs";
import NuevaOperacion from "@/components/ficha/NuevaOperacion";
import AsignarVendedor from "@/components/AsignarVendedor";
import VentaPaso, { type FacturaDatos } from "@/components/VentaPaso";
import CasoTarjeta from "@/components/casos/CasoTarjeta";
import BotonIA from "@/components/ia/BotonIA";
import { cargarCasos } from "@/lib/servidor/casos";
import NotaForm from "@/components/NotaForm";
import EquipoForm from "@/components/EquipoForm";
import DatosClienteForm from "@/components/DatosClienteForm";
import BorrarCliente from "@/components/BorrarCliente";
import EliminarOperacion from "@/components/EliminarOperacion";
import SucursalesCliente from "@/components/SucursalesCliente";
import DocumentosEntidad from "@/components/DocumentosEntidad";
import BotonesPdfCotizacion from "@/components/BotonesPdfCotizacion";
import type {
  Actividad,
  Cliente,
  Cotizacion,
  Equipo,
  Oportunidad,
  Producto,
  Recurrencia,
  Sucursal,
} from "@/lib/types";

const TIPO_OT: Record<string, string> = {
  correctivo: "Reparación",
  preventivo: "Mantenimiento",
  instalacion: "Instalación",
  garantia: "Garantía",
};

type OT = {
  id: string;
  numero: number;
  estado: string;
  tipo: string;
  equipo_id: string | null;
  fecha_programada: string | null;
  created_at: string;
  trabajo_realizado: string | null;
  cerrada_tecnico_at: string | null;
};

/** Momento actual (fuera del render: la regla de pureza de React no deja llamar a Date.now() adentro). */
const ahora = () => Date.now();

/** Qué movimientos se muestran como "del sistema" (centrados, en ámbar) y cuáles como burbuja de persona. */
const DE_PERSONA = new Set(["nota", "feria"]);

/**
 * La ficha del contacto (v1.9): cabecera corta (quién es, quién lo atiende,
 * WhatsApp / Llamar / Email) y pestañas: Operaciones (lo abierto y "Nueva
 * operación"), Historial (todo lo que pasó, como un chat), Cotizaciones,
 * Equipos y services, Personas y Datos. Abajo, fija, la caja para anotar.
 * Se usa como página completa y como panel al costado (PC); en el panel
 * todo desplaza junto para que se vea.
 */
export default async function FichaChat({
  clienteId,
  modo = "pagina",
  interesAbierto,
  cerrarHref,
  pestana,
}: {
  clienteId: string;
  modo?: "pagina" | "panel";
  interesAbierto?: string | null;
  cerrarHref?: string;
  /** Pestaña con la que abre (?tab=). */
  pestana?: string | null;
}) {
  const id = clienteId;
  const hoy = hoyISO();
  const supabase = await createClient();

  const [{ data: cliente }, { data: rol }, { data: auth }] = await Promise.all([
    supabase.from("clientes").select("*, sucursales(*)").eq("id", id).maybeSingle(),
    supabase.rpc("fn_rol"),
    supabase.auth.getUser(),
  ]);
  const miId = auth?.user?.id ?? "";
  const ahoraMs = ahora();
  if (!cliente) {
    if (modo === "panel")
      return <p className="p-4 text-[15px] text-piedra">Ese contacto no está o no lo podés ver.</p>;
    notFound();
  }
  const esGestor = ["direccion", "admin"].includes((rol as string) ?? "");
  const esTecnico = rol === "tecnico";
  const { sucursales: sucursalesData, ...restoCliente } = cliente as Cliente & { sucursales?: Sucursal[] };
  const sucursales = (sucursalesData ?? []).filter(
    (s) => !("deleted_at" in s) || !(s as { deleted_at?: string | null }).deleted_at
  );
  const principal = sucursales.find((s) => s.es_principal) ?? sucursales[0];
  const c: Cliente = { ...restoCliente, ciudad: principal?.ciudad ?? null };

  const [
    equiposRes,
    recurrenciasRes,
    oportunidadesRes,
    actividadesRes,
    productosRes,
    documentosRes,
    otsRes,
    usuariosRes,
    stockInfo,
    facturasRes,
    casosAbiertos,
    personasRes,
    solicitudesRep,
  ] = await Promise.all([
    supabase.from("equipos").select("*, producto:productos(*)").eq("cliente_id", id).is("deleted_at", null).order("fecha_venta", { ascending: false }),
    supabase.from("recurrencias").select("*, producto:productos(*)").eq("cliente_id", id).eq("activa", true),
    supabase.from("oportunidades").select("*, producto:productos(*)").eq("cliente_id", id).order("created_at", { ascending: false }),
    supabase.from("actividades").select("*").eq("cliente_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("productos").select("*").eq("activo", true).order("nombre"),
    supabase.from("documentos").select("*").eq("entidad", "cliente").eq("entidad_id", id).order("created_at", { ascending: false }),
    supabase
      .from("ordenes_trabajo")
      .select("id, numero, estado, tipo, equipo_id, fecha_programada, created_at, trabajo_realizado, cerrada_tecnico_at")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("usuarios").select("id, nombre, rol, activo"),
    infoStockPorProducto(supabase),
    supabase
      .from("facturas")
      .select("id, oportunidad_id, numero, vencimiento, monto, moneda, cobro_estado, promesa_fecha, condicion_aprobada_at")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false }),
    cargarCasos(supabase, { abiertos: true, clienteId: id, ahora: ahoraMs, hoy }),
    supabase
      .from("contactos")
      .select("id, nombre, cargo, telefono, email, es_decisor")
      .eq("cliente_id", id)
      .is("deleted_at", null)
      .order("es_decisor", { ascending: false })
      .order("created_at"),
    cargarSolicitudes(supabase, { clienteId: id, limite: 50 }),
  ]);

  // Los consumibles o repuestos vendidos antes de la v1.4 quedaron como "equipo": no se muestran como equipos
  const equipos = ((equiposRes.data ?? []) as unknown as Equipo[]).filter(
    (e) => !e.producto?.es_consumible && e.producto?.categoria !== "repuesto"
  );
  const recurrencias = (recurrenciasRes.data ?? []) as unknown as Recurrencia[];
  const oportunidades = (oportunidadesRes.data ?? []) as unknown as Oportunidad[];
  const actividades = (actividadesRes.data ?? []) as unknown as Actividad[];
  const productos = (productosRes.data ?? []) as Producto[];
  const usuarios = (usuariosRes.data ?? []) as { id: string; nombre: string; rol: string; activo: boolean }[];
  const nombres = new Map(usuarios.map((u) => [u.id, u.nombre]));
  const vendedores = usuarios
    .filter((u) => u.activo && ["comercial", "direccion", "admin"].includes(u.rol))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const ots = (otsRes.data ?? []) as OT[];
  const personas = (personasRes.data ?? []) as Persona[];
  const nombrePersona = new Map(personas.map((p) => [p.id, p.nombre]));
  const principalPersona = personas[0] ?? null;

  const abiertas = oportunidades.filter((o) => (ETAPAS_ABIERTAS as readonly string[]).includes(o.etapa));
  const ventas = oportunidades.filter((o) => o.etapa === "ganada");
  const ventasEnCurso = ventas.filter((o) => o.pedido_estado !== "entregado");
  const facturaDe = new Map<string, FacturaDatos>();
  for (const f of (facturasRes.data ?? []) as (FacturaDatos & { oportunidad_id: string | null })[])
    if (f.oportunidad_id && !facturaDe.has(f.oportunidad_id)) facturaDe.set(f.oportunidad_id, f);
  const perdidas = oportunidades.filter((o) => o.etapa === "perdida");
  const esCliente = c.estado === "cliente_activo" || ventas.length > 0 || equipos.length > 0;
  const serieFaltante = new Set(equipos.filter((e) => e.oportunidad_id && !e.numero_serie).map((e) => e.oportunidad_id));
  const nombreProductos = (o: Oportunidad) => {
    const extra = (o.productos_extra ?? [])
      .map((pid) => productos.find((p) => p.id === pid)?.nombre)
      .filter(Boolean) as string[];
    return [o.producto?.nombre, ...extra].filter(Boolean).join(", ") || o.mensaje_inicial || "Interés";
  };

  // Cotizaciones de todos los intereses (con PDF firmado si hay)
  const oppIds = oportunidades.map((o) => o.id);
  const { data: cotData } = oppIds.length
    ? await supabase.from("cotizaciones").select("*, versiones:cotizacion_versiones(*)").in("oportunidad_id", oppIds)
    : { data: [] };
  const versionesPlanas = ((cotData ?? []) as Cotizacion[])
    .flatMap((cot) => (cot.versiones ?? []).map((v) => ({ ...v, oportunidad_id: cot.oportunidad_id, numeroCot: cot.numero })))
    .sort((a, b) => (b.created_at < a.created_at ? -1 : 1));
  const urlsVersiones = await Promise.all(versionesPlanas.map((v) => firmarUrl("documentos", v.archivo_path)));
  const versionesPor = new Map<string, VersionCot[]>();
  versionesPlanas.forEach((v, i) => {
    const lista = versionesPor.get(v.oportunidad_id) ?? [];
    lista.push({
      id: v.id,
      cotizacion_id: v.cotizacion_id,
      numeroCot: v.numeroCot,
      version: v.version,
      total: v.total,
      moneda: v.moneda,
      forma_pago: v.forma_pago,
      created_at: v.created_at,
      archivoUrl: urlsVersiones[i],
      aprobacion: v.aprobacion,
      aprobacion_nota: v.aprobacion_nota,
      iva_pct: v.iva_pct ?? null,
    });
    versionesPor.set(v.oportunidad_id, lista);
  });

  const docs = (documentosRes.data ?? []) as { id: string; tipo: string; nombre: string; path: string; created_at: string }[];
  const urlsDocs = await firmarUrls("documentos", docs.map((d) => d.path));
  const documentos = docs.map((d, i) => ({ id: d.id, tipo: d.tipo, nombre: d.nombre, created_at: d.created_at, url: urlsDocs[i] }));

  const ultimoServicePorEquipo = new Map<string, OT>();
  for (const ot of ots) if (ot.equipo_id && !ultimoServicePorEquipo.has(ot.equipo_id)) ultimoServicePorEquipo.set(ot.equipo_id, ot);

  const atiende = c.comercial_id ? nombres.get(c.comercial_id) : null;
  const empresa =
    c.razon_social && c.razon_social.trim().toLowerCase() !== c.nombre_comercial.trim().toLowerCase() ? c.razon_social : null;
  const interesesResumen = abiertas.map((o) => ({
    id: o.id,
    texto: `${o.linea && o.linea !== "equipos" ? `${nombreLinea(o.linea)}: ` : ""}${nombreProductos(o)}`,
    proximo: o.proximo_contacto,
    accion: o.proxima_accion ?? null,
  }));
  const interesPreseleccionado = abiertas.some((o) => o.id === interesAbierto) ? interesAbierto : null;

  // El chat: lo más viejo arriba, lo último cerca de la caja. Los primeros 30 a la vista.
  const cronologico = [...actividades].reverse();
  const anteriores = cronologico.length > 30 ? cronologico.slice(0, cronologico.length - 30) : [];
  const recientes = cronologico.slice(anteriores.length);
  const burbuja = (a: Actividad) => {
    const persona = DE_PERSONA.has(a.tipo);
    const quien = a.created_by ? nombres.get(a.created_by) : null;
    const cuando = `${haceCuanto(a.created_at)} · ${fechaCorta(a.created_at)}`;
    return persona ? (
      <div key={a.id} className="max-w-[88%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[15px] shadow-sm">
        {a.medio && (
          <p className="mb-0.5 text-xs font-bold text-marino">
            {textoActividad(a.medio, a.resultado)}
            {a.contacto_id && nombrePersona.get(a.contacto_id) ? ` · con ${nombrePersona.get(a.contacto_id)}` : ""}
          </p>
        )}
        {(!a.medio || a.contenido !== textoActividad(a.medio, a.resultado)) && <p className="whitespace-pre-wrap">{a.contenido}</p>}
        <p className="mt-0.5 text-xs text-piedra">
          {quien ? `${quien} · ` : ""}
          {cuando}
        </p>
      </div>
    ) : (
      <div key={a.id} className="self-center rounded-2xl bg-ambar-soft px-3.5 py-1.5 text-center text-sm text-tinta/80">
        {a.contenido}
        <span className="text-piedra"> · {fechaCorta(a.created_at)}</span>
      </div>
    );
  };


  const botonContacto = "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[15px] font-bold";
  const titulo = "mb-2 text-xs font-bold uppercase tracking-wide text-piedra";
  const tareaHref = `/tareas/nueva?titulo=${encodeURIComponent(`Seguimiento: ${c.nombre_comercial}`)}&link=${encodeURIComponent(
    `${(process.env.NEXT_PUBLIC_APP_URL || "https://gastroware-crm.vercel.app").replace(/\/$/, "")}/clientes/${c.id}`
  )}`;
  const faltanFiscales = faltanParaCotizar(datosFiscalesDe({ ...c, sucursales }));
  const repuestosAbiertos = solicitudesRep.filter((s) => !["ganada", "perdida"].includes(s.estado));
  const interesesVenta = abiertas.filter((o) => !solicitudesRep.some((s) => s.oportunidad_id === o.id));
  const nombreDeOpp = new Map(oportunidades.map((o) => [o.id, nombreProductos(o)]));

  // --- Operaciones: lo que está abierto con este cliente y "Nueva operación"
  const operaciones = (
    <div className="space-y-3">
      {casosAbiertos.map((k) => (
        <CasoTarjeta key={k.id} caso={k} iaOn={iaConfigurada()} />
      ))}
      {repuestosAbiertos.map((s) => (
        <TarjetaRepuesto key={s.oportunidad_id} s={s} hoy={hoy} yo={miId} puedeValidar={["tecnico", "servicio", "direccion", "admin"].includes((rol as string) ?? "")} />
      ))}
      {interesesVenta.map((o) => (
        <InteresFijado
          key={o.id}
          interes={o}
          nombre={nombreProductos(o)}
          productos={productosDeLinea(productos, o.linea)}
          stockTexto={o.producto_id && stockInfo[o.producto_id] ? textoStock(stockInfo[o.producto_id], fechaCorta) : null}
          versiones={versionesPor.get(o.id) ?? []}
          telefono={c.telefono}
          iaOn={iaConfigurada()}
          abierta={o.id === interesAbierto}
          hoy={hoy}
          rol={(rol as string) ?? "comercial"}
          miId={miId}
          responsableNombre={o.comercial_id ? nombres.get(o.comercial_id) ?? null : null}
          ahoraMs={ahoraMs}
        />
      ))}
      {ventasEnCurso.map((o) => (
        <div key={o.id} className="rounded-2xl border border-verde/30 bg-verde-soft p-3.5">
          <p className="text-[16px] font-extrabold">Venta: {nombreProductos(o)}</p>
          <p className="mb-2 text-xs text-piedra">
            {o.monto_estimado ? `${dinero(o.monto_estimado, o.moneda)} · ` : ""}
            vendido {fechaCorta(o.closed_at ?? o.created_at)}
            {o.nro_factura ? ` · factura ${o.nro_factura}` : ""}
          </p>
          <VentaPaso
            venta={o}
            rol={(rol as string) ?? "comercial"}
            hoy={hoy}
            factura={facturaDe.get(o.id) ?? null}
            pedirSerie={serieFaltante.has(o.id)}
            videoUrl={o.producto?.video_url ?? null}
            sucursales={sucursales}
            direccionSugerida={[principal?.direccion, principal?.ciudad].filter(Boolean).join(", ")}
            compacto
          />
          {esGestor && (
            <div className="mt-1">
              <EliminarOperacion oportunidadId={o.id} venta />
            </div>
          )}
        </div>
      ))}
      {casosAbiertos.length + repuestosAbiertos.length + interesesVenta.length + ventasEnCurso.length === 0 && (
        <p className="rounded-2xl bg-white px-4 py-5 text-center text-[15px] text-piedra shadow-sm">No hay operaciones abiertas con este cliente.</p>
      )}
      <NuevaOperacion clienteId={c.id} productosEquipos={productosDeLinea(productos, "equipos")} stockInfo={stockInfo} tareaHref={tareaHref} />
      {actividades.length > 0 && (
        <div className="pt-1">
          <p className={titulo}>Últimos movimientos</p>
          <div className="flex flex-col gap-2">{recientes.slice(-3).map(burbuja)}</div>
          <div className="mt-2 text-center">
            <IrAPestana a="historial">Ver todo el historial ({actividades.length})</IrAPestana>
          </div>
        </div>
      )}
    </div>
  );

  // --- Historial: todo lo que pasó, como un chat
  const historial = (
    <div className="space-y-3">
      {iaConfigurada() && (
        <BotonIA
          pregunta={`Resumime a ${c.nombre_comercial} (qué le interesa, en qué quedamos, qué debe) y decime el próximo paso con un mensaje listo para mandarle`}
          texto="Resumen y próximo paso con IA"
        />
      )}
      <div className="flex flex-col gap-2">
        {anteriores.length > 0 && (
          <details className="group">
            <summary className="min-h-10 cursor-pointer list-none self-center text-center text-sm text-azul underline [&::-webkit-details-marker]:hidden">
              Ver los {anteriores.length} movimientos anteriores
            </summary>
            <div className="mt-2 flex flex-col gap-2">{anteriores.map(burbuja)}</div>
          </details>
        )}
        {recientes.map(burbuja)}
        {actividades.length === 0 && <p className="self-center text-[15px] text-piedra">Todavía no pasó nada. Escribí abajo qué hablaron.</p>}
        {actividades.length >= 200 && <p className="self-center text-xs text-piedra">Se muestran los últimos 200 movimientos.</p>}
      </div>
    </div>
  );

  // --- Cotizaciones: todas, con su PDF; y "Cotizar" para cada interés abierto
  const cotizaciones = (
    <div className="space-y-3">
      {interesesVenta.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {interesesVenta.map((o) => (
            <Link key={o.id} href={`/cotizar/${o.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-bold text-white">
              <FileText className="h-4 w-4" /> {(versionesPor.get(o.id) ?? []).length ? "Nueva versión" : "Cotizar"}: {nombreProductos(o)}
            </Link>
          ))}
        </div>
      )}
      <div className="divide-y divide-borde/70 rounded-2xl border border-borde bg-white">
        {versionesPlanas.map((v, i) => (
          <div key={v.id} className="space-y-1 px-3.5 py-3">
            <p className="flex flex-wrap items-center gap-x-2 text-[15px]">
              <span className="font-bold">
                N° {v.numeroCot}
                {v.version > 1 ? ` v${v.version}` : ""}
              </span>
              <span>
                {dinero(v.total ?? 0, v.moneda)}
                {Number(v.iva_pct ?? 0) > 0 ? " + IVA" : ""}
              </span>
              <span className="text-sm text-piedra">· {fechaCorta(v.created_at)}</span>
              {v.aprobacion === "pendiente" && <span className="rounded-full bg-ambar-soft px-2 py-0.5 text-xs font-bold text-ambar">esperando aprobación</span>}
              {v.aprobacion === "rechazada" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">rechazada</span>}
            </p>
            <p className="text-sm text-piedra">{nombreDeOpp.get(v.oportunidad_id) ?? ""}</p>
            <div className="flex flex-wrap items-center gap-3 text-[15px]">
              {v.aprobacion !== "pendiente" && v.aprobacion !== "rechazada" && <BotonesPdfCotizacion cotizacionId={v.cotizacion_id} version={v.version} compacto />}
              {urlsVersiones[i] && (
                <a href={urlsVersiones[i]!} target="_blank" rel="noopener noreferrer" className="text-azul underline">
                  PDF propio
                </a>
              )}
            </div>
          </div>
        ))}
        {versionesPlanas.length === 0 && <p className="px-4 py-5 text-center text-[15px] text-piedra">Todavía no hay cotizaciones.</p>}
      </div>
    </div>
  );

  // --- Equipos, consumibles que repone y services
  const equiposYServices = (
    <div className="space-y-4">
      <section className="space-y-2 rounded-2xl border border-borde bg-white p-3.5">
        <p className={titulo}>Equipos</p>
        {equipos.map((e) => {
          const vigente = e.garantia_hasta && e.garantia_hasta >= hoy;
          const ultimo = ultimoServicePorEquipo.get(e.id);
          return (
            <Link key={e.id} href={`/equipos/${e.id}`} className="block rounded-xl bg-crema px-3 py-2.5 text-[15px]">
              <p className="font-semibold hover:underline">
                {e.producto?.nombre ?? e.marca_modelo_libre}
                {e.origen === "externo" && <span className="ml-1.5 rounded-full border border-borde px-2 py-0.5 text-xs font-normal text-piedra">otra marca</span>}
              </p>
              <p className="text-xs text-piedra">
                {e.numero_serie ? `Serie ${e.numero_serie}` : "Sin número de serie"}
                {e.garantia_hasta && (
                  <span className={vigente ? "text-verde" : "text-piedra"}>
                    {" "}
                    · garantía {vigente ? "vigente" : "vencida"} ({fechaCorta(e.garantia_hasta)})
                  </span>
                )}
                {ultimo ? ` · último service ${fechaCorta(ultimo.cerrada_tecnico_at ?? ultimo.fecha_programada ?? ultimo.created_at)}` : " · sin services"}
              </p>
            </Link>
          );
        })}
        {equipos.length === 0 && <p className="text-[15px] text-piedra">Ningún equipo cargado todavía.</p>}
        <details className="pt-1">
          <summary className="cursor-pointer list-none text-sm font-bold text-marino underline [&::-webkit-details-marker]:hidden">+ Agregar un equipo que tiene</summary>
          <div className="mt-2">
            <EquipoForm clienteId={c.id} productos={productos} />
          </div>
        </details>
      </section>

      {recurrencias.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-borde bg-white p-3.5">
          <p className={titulo}>Consumibles que repone</p>
          {recurrencias.map((r) => {
            const repone = reposicionEstimada(r.ultima_compra, r.frecuencia_dias);
            return (
              <p key={r.id} className="text-sm">
                <Bell className="-mt-0.5 mr-1 inline h-3.5 w-3.5 text-verde" />
                <span className="font-semibold">{r.producto?.nombre}</span>
                {r.ultima_compra
                  ? ` · última compra ${fechaCorta(r.ultima_compra)}${r.ultima_cantidad ? ` (${cantidadTexto(r.ultima_cantidad, r.unidad)})` : ""}, hace ${diasDesde(r.ultima_compra)} días`
                  : ""}
                {r.frecuencia_dias ? ` · repone cada ${r.frecuencia_dias} días${repone ? ` (~${fechaCorta(repone)})` : ""}` : " · tiempo sin definir"}
                {` · contactar ${fechaCorta(r.proxima_alerta)}`}
              </p>
            );
          })}
          <Link href="/consumibles?ver=todos" className="text-sm font-bold text-marino underline">
            Ver y ajustar en Consumibles
          </Link>
        </section>
      )}

      <section className="space-y-2 rounded-2xl border border-borde bg-white p-3.5">
        <p className={titulo}>Services y reclamos</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/casos/nuevo?cliente=${c.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-ambar px-4 text-[15px] font-bold text-white">
            Abrir caso (reclamo)
          </Link>
          {(esTecnico || esGestor) && (
            <Link href={`/servicio/cargar?cliente=${c.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-bold text-white">
              <Wrench className="h-4 w-4" /> Cargar service hecho
            </Link>
          )}
          <Link href={`/servicio/nueva?cliente=${c.id}`} className="inline-flex min-h-11 items-center rounded-xl border border-borde bg-white px-4 text-[15px] font-bold">
            Programar service
          </Link>
        </div>
        {ots.slice(0, 10).map((o) => {
          const est = ESTADOS_OT.find((e) => e.value === o.estado);
          return (
            <Link key={o.id} href={`/servicio/${o.id}`} className="block rounded-xl bg-crema px-3 py-2.5 text-[15px]">
              <p className="font-semibold">
                {TIPO_OT[o.tipo] ?? o.tipo}{" "}
                <span className="font-normal text-piedra">
                  · {fechaCorta(o.cerrada_tecnico_at ?? o.fecha_programada ?? o.created_at)} · {est?.label ?? o.estado}
                </span>
              </p>
              {o.trabajo_realizado && <p className="truncate text-xs text-piedra">{o.trabajo_realizado}</p>}
            </Link>
          );
        })}
        {ots.length === 0 && <p className="text-[15px] text-piedra">Sin services todavía.</p>}
      </section>
    </div>
  );

  // --- Datos: fiscales, sucursales, documentos, notas
  const notasCliente = personas.length ? notasSinContacto(c.notas) : c.notas;
  const datosTab = (
    <div className="space-y-3">
      {faltanFiscales.length > 0 && (
        <p className="rounded-xl bg-ambar-soft px-3 py-2.5 text-sm font-semibold text-ambar">
          Para cotizar faltan: {faltanFiscales.join(", ")}. Completalos acá o al cotizar.
        </p>
      )}
      <DatosClienteForm cliente={c} />
      <div className="grid gap-3 lg:grid-cols-2">
        <SucursalesCliente clienteId={c.id} sucursales={sucursales} />
        <DocumentosEntidad entidad="cliente" entidadId={c.id} documentos={documentos} puedeBorrar />
      </div>
      {notasCliente && (
        <div className="rounded-2xl border border-borde bg-white p-3.5">
          <p className={titulo}>Notas del cliente</p>
          <p className="whitespace-pre-wrap text-[15px] text-tinta/80">{notasCliente}</p>
        </div>
      )}
      {perdidas.length > 0 && (
        <div className="rounded-2xl border border-borde bg-white p-3.5">
          <p className={titulo}>Intereses que no se dieron</p>
          {perdidas.map((o) => (
            <p key={o.id} className="text-[15px] text-piedra">
              {nombreProductos(o)} · {fechaCorta(o.closed_at ?? o.created_at)}
              {o.motivo_perdida ? ` · ${o.motivo_perdida}` : ""}
            </p>
          ))}
        </div>
      )}
      <div className="rounded-2xl border border-borde bg-white p-3.5">
        <p className={titulo}>Nota interna</p>
        <NotaForm clienteId={c.id} />
      </div>
      {esGestor && <BorrarCliente clienteId={c.id} nombre={c.nombre_comercial} />}
    </div>
  );

  const abiertasCount = casosAbiertos.length + repuestosAbiertos.length + interesesVenta.length + ventasEnCurso.length;
  const pestanas: Pestana[] = [
    ...(esTecnico ? [] : [{ key: "operaciones", label: "Operaciones", badge: abiertasCount, contenido: operaciones }]),
    { key: "historial", label: "Historial", contenido: historial },
    ...(esTecnico ? [] : [{ key: "cotizaciones", label: "Cotizaciones", badge: versionesPlanas.length, contenido: cotizaciones }]),
    { key: "equipos", label: "Equipos", badge: equipos.length + ots.length, contenido: equiposYServices },
    { key: "personas", label: "Personas", badge: personas.length, contenido: <PersonasCliente clienteId={c.id} personas={personas} /> },
    { key: "datos", label: "Datos", alerta: !esTecnico && faltanFiscales.length > 0, contenido: datosTab },
  ];
  const inicial = pestana && pestanas.some((p) => p.key === pestana) ? pestana : esTecnico ? "equipos" : "operaciones";

  const cabecera = (
    <header className="space-y-2.5">
      <div className="flex items-start gap-2">
        {modo === "pagina" ? (
          <Link href="/clientes" aria-label="Volver" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-borde bg-white">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold leading-tight tracking-tight">{c.nombre_comercial}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${esCliente ? "bg-verde-soft text-verde" : "bg-azul-soft text-azul"}`}>
              {esCliente ? "Cliente" : "Interesado"}
            </span>
          </div>
          <p className="text-sm text-piedra">
            {[
              principalPersona && principalPersona.nombre.trim().toLowerCase() !== c.nombre_comercial.trim().toLowerCase()
                ? `${principalPersona.nombre}${principalPersona.cargo ? ` (${principalPersona.cargo})` : ""}`
                : null,
              empresa,
              c.rubro !== "Otro" ? c.rubro : null,
              c.ciudad,
              c.telefono ? telefonoProlijo(c.telefono) : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Sin más datos por ahora"}
          </p>
          <div className="mt-1">
            {esGestor ? (
              <AsignarVendedor clienteId={c.id} actual={c.comercial_id} vendedores={vendedores} />
            ) : atiende ? (
              <p className="text-sm text-piedra">Lo atiende {atiende}</p>
            ) : null}
          </div>
        </div>
        {modo === "panel" ? (
          <div className="flex shrink-0 gap-1.5">
            <Link
              href={`/clientes/${c.id}`}
              aria-label="Abrir la ficha completa"
              title="Abrir la ficha completa"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-borde bg-white"
            >
              <Maximize2 className="h-4 w-4" />
            </Link>
            {cerrarHref ? (
              <Link href={cerrarHref} scroll={false} aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-full border border-borde bg-white">
                <X className="h-5 w-5" />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex gap-2">
        {c.telefono ? (
          <>
            <a href={linkWhatsApp(c.telefono)} target="_blank" rel="noopener noreferrer" className={`${botonContacto} bg-verde text-white`}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <a href={`tel:${c.telefono}`} className={`${botonContacto} border border-borde bg-white`}>
              <Phone className="h-4 w-4" /> Llamar
            </a>
          </>
        ) : (
          <IrAPestana a="datos" className={`${botonContacto} border border-dashed border-ambar/60 bg-ambar-soft text-ambar`}>
            <Phone className="h-4 w-4" /> Cargar teléfono
          </IrAPestana>
        )}
        {c.email ? (
          <a href={`mailto:${c.email}`} className={`${botonContacto} border border-borde bg-white`}>
            <Mail className="h-4 w-4" /> Email
          </a>
        ) : null}
      </div>
    </header>
  );

  const compositor = (
    <Compositor
      clienteId={c.id}
      intereses={interesesResumen}
      oportunidadId={interesPreseleccionado}
      personas={personas.map((p) => ({ id: p.id, nombre: p.nombre }))}
    />
  );

  if (modo === "panel") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
          <FichaTabs key={c.id} cabecera={cabecera} pestanas={pestanas} inicial={inicial} enPanel />
        </div>
        <div className="shrink-0 border-t border-borde bg-white px-4 py-3">{compositor}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <FichaTabs key={c.id} cabecera={cabecera} pestanas={pestanas} inicial={inicial} />
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-borde bg-crema/95 px-4 py-2.5 backdrop-blur lg:bottom-0 lg:mx-0 lg:rounded-2xl lg:border [html[data-teclado]_&]:bottom-0">
        {compositor}
      </div>
    </div>
  );
}
